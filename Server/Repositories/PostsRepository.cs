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
            if (!await db.Media.AnyAsync(m => m.Hash == media.Hash))
                db.Media.Add(media);

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

    public async Task DeleteFavorite(Guid userId, Guid postId)
    {
        await db.UserFavorites
            .Where(f => f.UserId == userId && f.PostId == postId)
            .ExecuteDeleteAsync();
    }

    public async Task<Matchup> CreateMatchup(Guid voterId)
    {
        try
        {
            var postA = await RandomPost(exclude: Guid.Empty);
            var postB = postA is null ? null : await RandomPost(exclude: postA.Id);

            if (postA is null || postB is null) throw new NotEnoughPostsException();

            postA.RandKey = Random.Shared.NextDouble();
            postB.RandKey = Random.Shared.NextDouble();

            Matchup matchup = new()
            {
                VoterId = voterId,
                PostA = postA,
                PostB = postB
            };

            db.Matchups.Add(matchup);
            await db.SaveChangesAsync();
            return matchup;
        }
        catch (System.Exception ex) when (ex is not ApiException)
        {
            logger.LogError(ex, "Failed to create matchup");
            throw new FailedToCreateInDatabaseException();
        }
    }

    async Task<Post?> RandomPost(Guid exclude)
    {
        double r = Random.Shared.NextDouble();
        var live = db.Posts.Where(p => p.DeletedAt == null && p.Id != exclude);

        return await live.Where(p => p.RandKey >= r).OrderBy(p => p.RandKey).FirstOrDefaultAsync()
            ?? await live.OrderBy(p => p.RandKey).FirstOrDefaultAsync();
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
        IQueryable<Post> posts = db.Posts.Where(p => p.DeletedAt == null);

        posts = order == "worst"
            ? posts.OrderBy(p => p.Elo)
            : posts.OrderByDescending(p => p.Elo);

        return await posts.Take(10).ToListAsync();
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
