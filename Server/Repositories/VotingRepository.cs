using Microsoft.EntityFrameworkCore;
using Server.Exceptions;
using static Server.Controllers.VotingController;

namespace Server.Repositories;

public class VotingRepository(AppDbContext db)
{
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
            throw new FailedToCreateInDatabaseException(ex);
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
        var (matchupId, winnerId, loserId) = (voteRequest.MatchupId, voteRequest.WinnerPostId, voteRequest.LoserPostId);

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
            throw new FailedToCreateInDatabaseException(ex);
        }

        if (inserted == 1) return;

        var matchup = await db.Matchups
            .Where(m => m.Id == matchupId)
            .Select(m => new { m.VoterId, HasVote = m.Vote != null })
            .FirstOrDefaultAsync();

        if (matchup is null || matchup.VoterId != voterId)
        {
            throw new MatchupDoesntExistException();
        }

        if (matchup.HasVote)
        {
            throw new VoteAlreadySubmittedException();
        }

        throw new InvalidVoteException();
    }
}
