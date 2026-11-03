using Microsoft.EntityFrameworkCore;

namespace Server.Workers;

public class VoteWorker(IServiceScopeFactory scopeFactory, ILogger<VoteWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Vote worker started");

        using var timer = new PeriodicTimer(PollInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            await RecalculatePosts(db, stoppingToken);

            await db.SaveChangesAsync(stoppingToken);
        }
    }

    static async Task RecalculatePosts(AppDbContext db, CancellationToken stoppingToken)
    {
        var uncountedVotes = await db.Votes
            .Where(v => v.CountedAt == null)
            .OrderBy(v => v.CreatedAt)
            .Include(v => v.Winner).ThenInclude(p => p.User)
            .Include(v => v.Loser).ThenInclude(p => p.User)
            .ToListAsync(stoppingToken);

        var peakDropped = new HashSet<Guid>();

        foreach (var vote in uncountedVotes)
        {
            float winnerOld = vote.Winner.Elo;
            float loserOld = vote.Loser.Elo;

            ApplyUser(vote.Winner.User, winnerOld, vote.Winner.Elo, win: true, peakDropped);
            ApplyUser(vote.Loser.User, loserOld, vote.Loser.Elo, win: false, peakDropped);
        }
    }

    static void ApplyUser(User user, float oldElo, float newElo, bool win, HashSet<Guid> peakDropped)
    {
        if (win) user.Wins++;
        else user.Losses++;

        if (newElo >= user.Elo)
            user.Elo = newElo;
        else if (oldElo >= user.Elo)
            peakDropped.Add(user.Id);
    }

    static void CalculateNewElo(ref float winner, ref float looser, float k = 32f)
    {
        float expectedWinner = 1f / (1f + MathF.Pow(10f, (looser - winner) / 400f));
        float expectedLooser = 1f - expectedWinner;

        winner += k * (1f - expectedWinner);
        looser += k * (0f - expectedLooser);
    }
}
