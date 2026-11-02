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

    public async Task<Matchup> CreateMatchup(Guid voterId)
    {
        try
        {
            var posts = await db.Posts
                .Where(p => p.DeletedAt == null)
                .OrderBy(p => EF.Functions.Random())
                .Take(2)
                .ToListAsync();

            if (posts.Count < 2) throw new FailedToCreateInDatabaseException();

            Matchup matchup = new()
            {
                VoterId = voterId,
                PostA = posts[0],
                PostB = posts[1]
            };

            db.Matchups.Add(matchup);
            await db.SaveChangesAsync();
            return matchup; 
        }
        catch (System.Exception ex)
        {
            logger.LogError(ex, "Failed to create matchup");
            throw new FailedToCreateInDatabaseException();
        }
    }

    public async Task SubmitVote(VoteRequest voteRequest)
    {
        if (db.Votes.Any(v => v.MatchupId == voteRequest.MatchupId))
        {
            logger.LogInformation("User tried to vote on a matchup already containing a vote");
            throw new VoteAlreadySubmittedException();
        }
            
        var matchup = await db.Matchups.FirstOrDefaultAsync(m => m.Id == voteRequest.MatchupId);
        if (matchup == null)
        {
            logger.LogInformation("User tried to vote on a matchup that doesnt exist");
            throw new MatchupDoesntExistException();
        }

        db.Votes.Add(new Vote()
        {
            MatchupId = voteRequest.MatchupId,
            WinnerId = voteRequest.WinnerPostId,
            LoserId = voteRequest.LooserPostId,
            WinnerWasA = voteRequest.WinnerPostId == matchup.PostAId
        });

        try
        {
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create vote in database");
            throw new FailedToCreateInDatabaseException();
        }
        
    }

    public async Task<List<Post>> GetRanking(string order)
    {
        IQueryable<Post> posts = db.Posts.Where(p => p.DeletedAt == null);

        posts = order == "worst"
            ? posts.OrderBy(p => p.Elo)
            : posts.OrderByDescending(p => p.Elo);

        return await posts.Take(10).ToListAsync();
    }
}
