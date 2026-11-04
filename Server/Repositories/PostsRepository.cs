using Microsoft.EntityFrameworkCore;
using Server.Exceptions;
using static Server.PostsController;

namespace Server;

public class PostsRepository(ILogger<PostsRepository> logger, AppDbContext db, PostPool postPool)
{
    public async Task<Post> CreatePost(Guid userId, Media media)
    {
        try
        {
            if (!await db.Media.AnyAsync(m => m.Hash == media.Hash))
                db.Media.Add(media);

            Post post = new()
            {
                UserId = userId,
                MediaHash = media.Hash
            };

            db.Posts.Add(post);
            await db.SaveChangesAsync();
            postPool.Invalidate();
            return post;
        }
        catch (System.Exception ex)
        {
            logger.LogError(ex, "Failed to create post");
            throw new FailedToCreateInDatabaseException();
        }
    }

    public async Task<List<Post>> GetFavorites(Guid userId)
    {
        return await db.UserFavorites
            .AsNoTracking()
            .Where(f => f.UserId == userId && f.Post.DeletedAt == null)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => f.Post)
            .ToListAsync();
    }

    public async Task CreateFavorite(Guid userId, Guid postId)
    {
        int inserted;
        try
        {
            inserted = await db.Database.ExecuteSqlAsync($"""
                INSERT INTO user_favorites (user_id, post_id)
                SELECT {userId}, p.id
                FROM posts p
                WHERE p.id = {postId} AND p.deleted_at IS NULL
                ON CONFLICT (user_id, post_id) DO NOTHING
                """);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create favorite in database");
            throw new FailedToCreateInDatabaseException();
        }

        if (inserted == 1) return;

        if (!await db.Posts.AnyAsync(p => p.Id == postId && p.DeletedAt == null))
            throw new PostDoesntExistException();

    }

    public async Task DeletePost(Guid userId, Guid postId)
    {
        int updated = await db.Posts
            .Where(p => p.Id == postId && p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.DeletedAt, p => p.DeletedAt ?? DateTimeOffset.UtcNow));

        if (updated == 0) throw new PostDoesntExistException();

        postPool.Invalidate();
    }

    public async Task DeleteFavorite(Guid userId, Guid postId)
    {
        await db.UserFavorites
            .Where(f => f.UserId == userId && f.PostId == postId)
            .ExecuteDeleteAsync();
    }

    const double HailMaryChance = 0.10;

    const int NearbyEachSide = 10;

    public async Task<(Matchup Matchup, Post PostA, Post PostB)> GetOrCreateMatchup(Guid voterId)
    {
        var snapshot = await postPool.Get();

        var latest = await db.Matchups
            .AsNoTracking()
            .Where(m => m.VoterId == voterId)
            .OrderByDescending(m => m.IssuedAt)
            .Select(m => new { Matchup = m, Voted = m.Vote != null })
            .FirstOrDefaultAsync();

        if (latest is { Voted: false }
            && snapshot.ById.TryGetValue(latest.Matchup.PostAId, out var openA)
            && snapshot.ById.TryGetValue(latest.Matchup.PostBId, out var openB))
            return (latest.Matchup, openA, openB);

        var pool = snapshot.ByElo;

        int a = RandomIndex(pool, voterId, exclude: -1);
        if (a < 0) throw new NotEnoughPostsException();

        int b = Random.Shared.NextDouble() < HailMaryChance
            ? RandomIndex(pool, voterId, exclude: a)
            : NearbyIndex(pool, voterId, a);
        if (b < 0) throw new NotEnoughPostsException();

        Matchup matchup = new()
        {
            VoterId = voterId,
            PostAId = pool[a].Id,
            PostBId = pool[b].Id
        };

        try
        {
            db.Matchups.Add(matchup);
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create matchup");
            throw new FailedToCreateInDatabaseException();
        }

        return (matchup, pool[a], pool[b]);
    }

    static int RandomIndex(Post[] pool, Guid voterId, int exclude)
    {
        if (pool.Length == 0) return -1;

        for (int tries = 0; tries < 16; tries++)
        {
            int i = Random.Shared.Next(pool.Length);
            if (i != exclude && pool[i].UserId != voterId) return i;
        }

        var others = Enumerable.Range(0, pool.Length).Where(i => i != exclude && pool[i].UserId != voterId).ToArray();
        return others.Length == 0 ? -1 : others[Random.Shared.Next(others.Length)];
    }

    static int NearbyIndex(Post[] pool, Guid voterId, int a)
    {
        Span<int> nearby = stackalloc int[NearbyEachSide * 2];
        int n = 0;

        for (int i = a + 1, found = 0; i < pool.Length && found < NearbyEachSide; i++)
            if (pool[i].UserId != voterId) { nearby[n++] = i; found++; }

        for (int i = a - 1, found = 0; i >= 0 && found < NearbyEachSide; i--)
            if (pool[i].UserId != voterId) { nearby[n++] = i; found++; }

        return n == 0 ? -1 : nearby[Random.Shared.Next(n)];
    }

    public async Task SubmitVote(Guid voterId, VoteRequest voteRequest)
    {
        var (matchupId, winnerId, loserId) = (voteRequest.MatchupId, voteRequest.WinnerPostId, voteRequest.LooserPostId);

        int inserted;
        try
        {
            inserted = await db.Database.ExecuteSqlAsync($"""
                INSERT INTO votes (matchup_id, winner_id, loser_id, winner_was_a)
                SELECT m.id, {winnerId}, {loserId}, m.post_a_id = {winnerId}
                FROM matchups m
                WHERE m.id = {matchupId}
                  AND m.voter_id = {voterId}
                  AND ((m.post_a_id = {winnerId} AND m.post_b_id = {loserId})
                    OR (m.post_b_id = {winnerId} AND m.post_a_id = {loserId}))
                ON CONFLICT (matchup_id) DO NOTHING
                """);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create vote in database");
            throw new FailedToCreateInDatabaseException();
        }

        if (inserted == 1) return;

        var matchup = await db.Matchups
            .Where(m => m.Id == matchupId)
            .Select(m => new { m.VoterId, HasVote = m.Vote != null })
            .FirstOrDefaultAsync();

        if (matchup is null || matchup.VoterId != voterId)
        {
            logger.LogInformation("User tried to vote on a matchup that doesnt exist or isnt theirs");
            throw new MatchupDoesntExistException();
        }

        if (matchup.HasVote)
        {
            logger.LogInformation("User tried to vote on a matchup already containing a vote");
            throw new VoteAlreadySubmittedException();
        }

        logger.LogInformation("User voted with posts that dont belong to the matchup");
        throw new InvalidVoteException();
    }

    public async Task<List<Post>> GetRanking(string order)
    {
        var pool = (await postPool.Get()).ByElo;

        return order == "worst"
            ? pool.Take(10).ToList()
            : pool.TakeLast(10).Reverse().ToList();
    }

    public async Task<User?> GetUser(Guid userId)
    {
        return await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
    }

    public async Task<List<Post>> GetUserPosts(Guid userId)
    {
        return await db.Posts.Where(p => p.UserId == userId && p.DeletedAt == null).OrderByDescending(p => p.CreatedAt).ToListAsync();
    }

    public async Task SetAvatar(Guid userId, Media media)
    {
        if (!await db.Media.AnyAsync(m => m.Hash == media.Hash))
        db.Media.Add(media);

        var user = await db.Users.FirstAsync(u => u.Id == userId);
        user.AvatarHash = media.Hash;
        await db.SaveChangesAsync();
    }

    public async Task SetDescription(Guid userId, string? description)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId);
        user.Description = description;
        await db.SaveChangesAsync();
    }
}
