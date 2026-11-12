using Microsoft.EntityFrameworkCore;

namespace Server.Repositories;

public class RankingRepository(AppDbContext db)
{
    public static readonly TimeSpan TrendingWindow = TimeSpan.FromHours(48);

    const int RankingSize = 10;

    public async Task<List<Post>> GetRanking(RankingPeriod period, RankingOrder order)
    {
        if (period == RankingPeriod.Trending) return await GetTrending(order);

        var posts = db.Posts.AsNoTracking()
            .Include(p => p.Media)
            .Include(p => p.User).ThenInclude(u => u.Avatar)
            .Where(p => p.DeletedAt == null);

        if (period == RankingPeriod.Week)
        {
            var week = CurrentWeek();
            posts = posts.Where(p => p.CreatedWeek == week);
        }

        return await (order == RankingOrder.Worst
            ? posts.OrderBy(p => p.Elo).ThenBy(p => p.RandKey)
            : posts.OrderByDescending(p => p.Elo).ThenByDescending(p => p.RandKey))
            .Take(RankingSize)
            .ToListAsync();
    }

    async Task<List<Post>> GetTrending(RankingOrder order)
    {
        var since = DateTimeOffset.UtcNow - TrendingWindow;

        var ids = await (order == RankingOrder.Worst
            ? db.Database.SqlQuery<Guid>($"""
                SELECT c.post_id AS "Value"
                FROM post_elo_changes c
                JOIN posts p ON p.id = c.post_id AND p.deleted_at IS NULL
                WHERE c.hour >= {since}
                GROUP BY c.post_id
                HAVING SUM(c.elo_change) < 0
                ORDER BY SUM(c.elo_change), c.post_id
                LIMIT {RankingSize}
                """)
            : db.Database.SqlQuery<Guid>($"""
                SELECT c.post_id AS "Value"
                FROM post_elo_changes c
                JOIN posts p ON p.id = c.post_id AND p.deleted_at IS NULL
                WHERE c.hour >= {since}
                GROUP BY c.post_id
                HAVING SUM(c.elo_change) > 0
                ORDER BY SUM(c.elo_change) DESC, c.post_id
                LIMIT {RankingSize}
                """)).ToListAsync();

        var posts = await db.Posts.AsNoTracking()
            .Include(p => p.Media)
            .Include(p => p.User).ThenInclude(u => u.Avatar)
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        return ids.Where(posts.ContainsKey).Select(id => posts[id]).ToList();
    }

    static DateOnly CurrentWeek()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }
}
