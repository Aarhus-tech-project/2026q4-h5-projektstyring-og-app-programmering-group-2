using Microsoft.EntityFrameworkCore;
using static Server.PostsController;

namespace Server;

public class PostsRepository(AppDbContext db)
{
    public async Task<Post> CreatePost(Guid userId, Media media)
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

    public async Task<Matchup?> GetMatchup(Guid voterId)
    {
        var posts = await db.Posts
            .Where(p => p.DeletedAt == null)
            .OrderBy(p => EF.Functions.Random())
            .Take(2)
            .ToListAsync();

        if (posts.Count < 2) return null;

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

    public async Task<bool> SubmitVote(VoteRequest voteRequest)
    {
        if (db.Votes.Any(v => v.MatchupId == voteRequest.MatchupId)) return false;

        var matchup = await db.Matchups.FirstOrDefaultAsync(m => m.Id == voteRequest.MatchupId);
        if (matchup == null) return false;

        db.Votes.Add(new Vote()
        {
            MatchupId = voteRequest.MatchupId,
            WinnerId = voteRequest.WinnerPostId,
            LoserId = voteRequest.LooserPostId,
            WinnerWasA = voteRequest.WinnerPostId == matchup.PostAId
        });

        await db.SaveChangesAsync();
        return true;
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
