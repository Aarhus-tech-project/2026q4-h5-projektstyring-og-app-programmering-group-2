using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Server.Workers;

public class VoteWorker(IServiceScopeFactory scopeFactory, ILogger<VoteWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);
    private const int BatchSize = 10_000;
    private const long VoteCountingLockKey = 7_000_001;
    private static readonly TimeSpan EloChangeRetention = PostsRepository.TrendingWindow * 2;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Vote worker started");

        using var timer = new PeriodicTimer(PollInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await CountPendingVotes(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Vote counting failed, retrying in {PollInterval}", PollInterval);
            }
        }
    }

    async Task CountPendingVotes(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var stopwatch = Stopwatch.StartNew();
        int total = 0, batches = 0, counted;
        do
        {
            counted = await CountBatch(db, ct);
            if (counted < 0)
            {
                logger.LogDebug("Skipped vote counting, another worker holds the lock");
                return;
            }
            total += counted;
            if (counted > 0) batches++;
        }
        while (counted == BatchSize);

        if (total > 0)
            logger.LogInformation("Counted {Votes} votes in {Batches} batches in {ElapsedMs} ms", total, batches, stopwatch.ElapsedMilliseconds);
    }

    static async Task<int> CountBatch(AppDbContext db, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        bool gotLock = await db.Database
            .SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock({VoteCountingLockKey}) AS \"Value\"")
            .SingleAsync(ct);
        if (!gotLock) return -1;

        var votes = await db.Votes
            .AsNoTracking()
            .Where(v => v.CountedAt == null)
            .OrderBy(v => v.CreatedAt).ThenBy(v => v.MatchupId)
            .Take(BatchSize)
            .Select(v => new { v.MatchupId, v.WinnerId, v.LoserId, v.CreatedAt })
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
        var hourlyChanges = new Dictionary<(Guid PostId, DateTimeOffset Hour), float>();

        for (int i = 0; i < votes.Count; i++)
        {
            var winner = posts[votes[i].WinnerId];
            var loser = posts[votes[i].LoserId];

            winnerBefore[i] = winner.Elo;
            loserBefore[i] = loser.Elo;

            CalculateNewElo(ref winner.Elo, ref loser.Elo);
            winner.Wins++;
            loser.Losses++;

            var hour = TruncateToHour(votes[i].CreatedAt);
            hourlyChanges[(winner.Id, hour)] = hourlyChanges.GetValueOrDefault((winner.Id, hour)) + (winner.Elo - winnerBefore[i]);
            hourlyChanges[(loser.Id, hour)] = hourlyChanges.GetValueOrDefault((loser.Id, hour)) + (loser.Elo - loserBefore[i]);
        }

        var changedPosts = posts.Values.ToArray();
        var postIdArr = changedPosts.Select(p => p.Id).ToArray();
        var postEloArr = changedPosts.Select(p => p.Elo).ToArray();
        var postWinsArr = changedPosts.Select(p => p.Wins).ToArray();
        var postLossesArr = changedPosts.Select(p => p.Losses).ToArray();

        var userIdArr = changedPosts.Select(p => p.UserId).Distinct().ToArray();

        var changePostIdArr = hourlyChanges.Keys.Select(k => k.PostId).ToArray();
        var changeHourArr = hourlyChanges.Keys.Select(k => k.Hour).ToArray();
        var changeEloArr = hourlyChanges.Values.ToArray();
        var pruneBefore = DateTimeOffset.UtcNow - EloChangeRetention;

        var voteIdArr = votes.Select(v => v.MatchupId).ToArray();
        var countedAt = DateTimeOffset.UtcNow;

        await db.Database.ExecuteSqlAsync($"""
            UPDATE posts p
            SET elo = x.elo, wins = x.wins, losses = x.losses
            FROM unnest({postIdArr}, {postEloArr}, {postWinsArr}, {postLossesArr}) AS x(id, elo, wins, losses)
            WHERE p.id = x.id
            """, ct);

        await UserStats.Recompute(db, userIdArr, ct);

        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO post_elo_changes (post_id, hour, elo_change)
            SELECT * FROM unnest({changePostIdArr}, {changeHourArr}, {changeEloArr})
            ON CONFLICT (hour, post_id) DO UPDATE SET elo_change = post_elo_changes.elo_change + excluded.elo_change
            """, ct);

        await db.Database.ExecuteSqlAsync($"DELETE FROM post_elo_changes WHERE hour < {pruneBefore}", ct);

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

    static DateTimeOffset TruncateToHour(DateTimeOffset at)
    {
        var utc = at.UtcDateTime;
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, TimeSpan.Zero);
    }

    static void CalculateNewElo(ref float winner, ref float looser, float k = 32f)
    {
        float expectedWinner = 1f / (1f + MathF.Pow(10f, (looser - winner) / 400f));
        float expectedLooser = 1f - expectedWinner;

        winner += k * (1f - expectedWinner);
        looser += k * (0f - expectedLooser);
    }
}
