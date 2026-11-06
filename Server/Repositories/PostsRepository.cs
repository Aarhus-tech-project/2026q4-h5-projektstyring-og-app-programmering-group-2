using Microsoft.EntityFrameworkCore;
using Server.Exceptions;
using static Server.PostsController;

namespace Server;

public class PostsRepository(ILogger<PostsRepository> logger, AppDbContext db)
{
    public async Task<Post> CreatePost(Guid userId, Media media)
    {
        try
        {
            await InsertMediaIfMissing(media);

            Post post = new()
            {
                UserId = userId,
                MediaHash = media.Hash
            };

            db.Posts.Add(post);
            await db.SaveChangesAsync();
            return post;
        }
        catch (System.Exception ex)
        {
            logger.LogError(ex, "Failed to create post");
            throw new FailedToCreateInDatabaseException();
        }
    }

    async Task InsertMediaIfMissing(Media media)
    {
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO media (hash, kind, width, height, thumbhash, original_format, original_size_bytes, camera_make, camera_model, taken_at)
            VALUES ({media.Hash}, {media.Kind.ToString()}, {media.Width}, {media.Height}, {media.Thumbhash}, {media.OriginalFormat},
                    {media.OriginalSizeBytes}, {media.CameraMake}, {media.CameraModel}, {media.TakenAt})
            ON CONFLICT (hash) DO NOTHING
            """);
    }

    public async Task<List<Post>> GetFavorites(Guid userId)
    {
        return await db.UserFavorites
            .AsNoTracking()
            .Where(f => f.UserId == userId && f.Post.DeletedAt == null)
            .OrderByDescending(f => f.CreatedAt)
            .Include(f => f.Post).ThenInclude(p => p.Media)
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
        var latest = await db.Matchups
            .AsNoTracking()
            .Include(m => m.Vote)
            .Include(m => m.PostA).ThenInclude(p => p.Media)
            .Include(m => m.PostB).ThenInclude(p => p.Media)
            .Where(m => m.VoterId == voterId)
            .OrderByDescending(m => m.IssuedAt)
            .FirstOrDefaultAsync();

        if (latest is { Vote: null } && latest.PostA.DeletedAt == null && latest.PostB.DeletedAt == null)
            return (latest, latest.PostA, latest.PostB);

        Post a = await RandomPost(voterId, exclude: null) ?? throw new NotEnoughPostsException();

        Post b = (Random.Shared.NextDouble() < HailMaryChance
            ? await RandomPost(voterId, exclude: a.Id)
            : await NearbyPost(voterId, a)) ?? throw new NotEnoughPostsException();

        Matchup matchup = new()
        {
            VoterId = voterId,
            PostAId = a.Id,
            PostBId = b.Id
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

        return (matchup, a, b);
    }

    async Task<Post?> RandomPost(Guid voterId, Guid? exclude)
    {
        double start = Random.Shared.NextDouble();

        var candidates = db.Posts
            .AsNoTracking()
            .Include(p => p.Media)
            .Where(p => p.DeletedAt == null && p.UserId != voterId && p.Id != exclude)
            .OrderBy(p => p.RandKey);

        return await candidates.FirstOrDefaultAsync(p => p.RandKey >= start)
            ?? await candidates.FirstOrDefaultAsync();
    }

    async Task<Post?> NearbyPost(Guid voterId, Post a)
    {
        var nearby = await db.Posts
            .FromSql($"""
                SELECT * FROM (
                    (SELECT * FROM posts
                     WHERE deleted_at IS NULL AND user_id <> {voterId} AND (elo, rand_key) > ({a.Elo}, {a.RandKey})
                     ORDER BY elo, rand_key
                     LIMIT {NearbyEachSide})
                    UNION ALL
                    (SELECT * FROM posts
                     WHERE deleted_at IS NULL AND user_id <> {voterId} AND (elo, rand_key) < ({a.Elo}, {a.RandKey})
                     ORDER BY elo DESC, rand_key DESC
                     LIMIT {NearbyEachSide})
                ) AS nearby
                """)
            .AsNoTracking()
            .Include(p => p.Media)
            .ToListAsync();

        return nearby.Count == 0 ? null : nearby[Random.Shared.Next(nearby.Count)];
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

    public async Task<List<Post>> GetRanking(RankingPeriod period, RankingOrder order)
    {
        if (period == RankingPeriod.Trending) return [];

        var posts = db.Posts.AsNoTracking().Include(p => p.Media).Where(p => p.DeletedAt == null);

        if (period == RankingPeriod.Week)
        {
            var week = CurrentWeek();
            posts = posts.Where(p => p.CreatedWeek == week);
        }

        return await (order == RankingOrder.Worst
            ? posts.OrderBy(p => p.Elo).ThenBy(p => p.RandKey)
            : posts.OrderByDescending(p => p.Elo).ThenByDescending(p => p.RandKey))
            .Take(10)
            .ToListAsync();
    }

    static DateOnly CurrentWeek()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    public async Task<User?> GetUser(Guid userId)
    {
        return await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
    }

    public async Task<List<Post>> GetUserPosts(Guid userId)
    {
        return await db.Posts.Include(p => p.Media).Where(p => p.UserId == userId && p.DeletedAt == null).OrderByDescending(p => p.CreatedAt).ToListAsync();
    }

    public async Task SetAvatar(Guid userId, Media media)
    {
        await InsertMediaIfMissing(media);

        await db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.AvatarHash, media.Hash));
    }

    public async Task SetDescription(Guid userId, string? description)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId);
        user.Description = description;
        await db.SaveChangesAsync();
    }
}
