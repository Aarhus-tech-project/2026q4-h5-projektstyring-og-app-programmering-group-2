using Microsoft.EntityFrameworkCore;

namespace Server;

public class PostPool(IServiceScopeFactory scopes, ILogger<PostPool> logger)
{
    static readonly TimeSpan RefreshInterval = TimeSpan.FromSeconds(30);

    public record Snapshot(Post[] ByElo, Dictionary<Guid, Post> ById, DateTimeOffset LoadedAt);

    volatile Snapshot? current;
    int generation;
    readonly SemaphoreSlim loading = new(1, 1);

    public async Task<Snapshot> Get()
    {
        var snapshot = current;
        if (snapshot is null)
            return (await Load(wait: true))!;

        if (DateTimeOffset.UtcNow - snapshot.LoadedAt > RefreshInterval)
            _ = Load(wait: false);

        return snapshot;
    }

    public void Invalidate()
    {
        Interlocked.Increment(ref generation);
        current = null;
    }

    async Task<Snapshot?> Load(bool wait)
    {
        if (!await loading.WaitAsync(wait ? Timeout.Infinite : 0)) return current;
        try
        {
            var snapshot = current;
            if (snapshot is not null && DateTimeOffset.UtcNow - snapshot.LoadedAt <= RefreshInterval)
                return snapshot;

            int startedAt = Volatile.Read(ref generation);

            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var posts = await db.Posts
                .AsNoTracking()
                .Where(p => p.DeletedAt == null)
                .OrderBy(p => p.Elo)
                .Select(p => new Post
                {
                    Id = p.Id,
                    UserId = p.UserId,
                    MediaHash = p.MediaHash,
                    Elo = p.Elo,
                    Wins = p.Wins,
                    Losses = p.Losses,
                    CreatedAt = p.CreatedAt
                })
                .ToArrayAsync();

            var loaded = new Snapshot(posts, posts.ToDictionary(p => p.Id), DateTimeOffset.UtcNow);
            if (Volatile.Read(ref generation) == startedAt)
                current = loaded;

            return loaded;
        }
        catch (Exception ex) when (!wait)
        {
            logger.LogWarning(ex, "Background reload of the post pool failed, keeping the old copy");
            return current;
        }
        finally
        {
            loading.Release();
        }
    }
}
