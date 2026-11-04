using Microsoft.EntityFrameworkCore;

namespace Server.Workers;

public class VoteWorker(IServiceScopeFactory scopeFactory, ILogger<VoteWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);
    private const int BatchSize = 10_000;
    private const long VoteCountingLockKey = 7_000_001;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Vote worker started");

        using var timer = new PeriodicTimer(PollInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            int counted;
            do counted = await CountBatch(db, stoppingToken);
            while (counted == BatchSize);
        }
    }

    static async Task<int> CountBatch(AppDbContext db, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        bool gotLock = await db.Database
            .SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock({VoteCountingLockKey}) AS \"Value\"")
            .SingleAsync(ct);
        if (!gotLock) return 0;

        var votes = await db.Votes
            .AsNoTracking()
            .Where(v => v.CountedAt == null)
            .OrderBy(v => v.CreatedAt).ThenBy(v => v.MatchupId)
            .Take(BatchSize)
            .Select(v => new { v.MatchupId, v.WinnerId, v.LoserId })
            .ToListAsync(ct);

        if (votes.Count == 0) return 0;

        var postIds = votes.SelectMany(v => new[] { v.WinnerId, v.LoserId }).Distinct().ToList();
        var posts = await db.Posts
            .AsNoTracking()
            .Where(p => postIds.Contains(p.Id))
            .Select(p => new PostState { Id = p.Id, UserId = p.UserId, Elo = p.Elo, Wins = p.Wins, Losses = p.Losses })
            .ToDictionaryAsync(p => p.Id, ct);

        var winnerBefore = new float[votes.Count];
        var loserBefore = new float[votes.Count];
        var userDeltas = new Dictionary<Guid, (int Wins, int Losses)>();

        for (int i = 0; i < votes.Count; i++)
        {
            var winner = posts[votes[i].WinnerId];
            var loser = posts[votes[i].LoserId];

            winnerBefore[i] = winner.Elo;
            loserBefore[i] = loser.Elo;

            CalculateNewElo(ref winner.Elo, ref loser.Elo);
            winner.Wins++;
            loser.Losses++;

            var w = userDeltas.GetValueOrDefault(winner.UserId);
            userDeltas[winner.UserId] = (w.Wins + 1, w.Losses);
            var l = userDeltas.GetValueOrDefault(loser.UserId);
            userDeltas[loser.UserId] = (l.Wins, l.Losses + 1);
        }

        var changedPosts = posts.Values.ToArray();
        var postIdArr = changedPosts.Select(p => p.Id).ToArray();
        var postEloArr = changedPosts.Select(p => p.Elo).ToArray();
        var postWinsArr = changedPosts.Select(p => p.Wins).ToArray();
        var postLossesArr = changedPosts.Select(p => p.Losses).ToArray();

        var userIdArr = userDeltas.Keys.ToArray();
        var userWinsArr = userDeltas.Values.Select(d => d.Wins).ToArray();
        var userLossesArr = userDeltas.Values.Select(d => d.Losses).ToArray();

        var voteIdArr = votes.Select(v => v.MatchupId).ToArray();
        var countedAt = DateTimeOffset.UtcNow;

        await db.Database.ExecuteSqlAsync($"""
            UPDATE posts p
            SET elo = x.elo, wins = x.wins, losses = x.losses
            FROM unnest({postIdArr}, {postEloArr}, {postWinsArr}, {postLossesArr}) AS x(id, elo, wins, losses)
            WHERE p.id = x.id
            """, ct);

        await db.Database.ExecuteSqlAsync($"""
            UPDATE users u
            SET wins = u.wins + x.wins,
                losses = u.losses + x.losses,
                elo = COALESCE((SELECT MAX(p.elo) FROM posts p WHERE p.user_id = u.id AND p.deleted_at IS NULL), u.elo)
            FROM unnest({userIdArr}, {userWinsArr}, {userLossesArr}) AS x(id, wins, losses)
            WHERE u.id = x.id
            """, ct);

        await db.Database.ExecuteSqlAsync($"""
            UPDATE votes v
            SET counted_at = {countedAt}, winner_elo_before = x.wb, loser_elo_before = x.lb
            FROM unnest({voteIdArr}, {winnerBefore}, {loserBefore}) AS x(id, wb, lb)
            WHERE v.matchup_id = x.id
            """, ct);

        await tx.CommitAsync(ct);
        return votes.Count;
    }
    
    sealed class PostState
    {
        public Guid Id;
        public Guid UserId;
        public float Elo;
        public int Wins;
        public int Losses;
    }

    static void CalculateNewElo(ref float winner, ref float looser, float k = 32f)
    {
        float expectedWinner = 1f / (1f + MathF.Pow(10f, (looser - winner) / 400f));
        float expectedLooser = 1f - expectedWinner;

        winner += k * (1f - expectedWinner);
        looser += k * (0f - expectedLooser);
    }
}
