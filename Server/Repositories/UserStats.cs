using Microsoft.EntityFrameworkCore;

namespace Server;

public static class UserStats
{
    public static Task<int> Recompute(AppDbContext db, Guid[] userIds, CancellationToken ct = default) =>
        db.Database.ExecuteSqlAsync($"""
            UPDATE users u
            SET wins = s.wins, losses = s.losses, elo = s.elo
            FROM (
                SELECT x.id,
                       COALESCE(SUM(p.wins), 0)::int AS wins,
                       COALESCE(SUM(p.losses), 0)::int AS losses,
                       COALESCE(MAX(p.elo), 1000)::real AS elo
                FROM unnest({userIds}) AS x(id)
                LEFT JOIN posts p ON p.user_id = x.id AND p.deleted_at IS NULL
                GROUP BY x.id
            ) s
            WHERE u.id = s.id
            """, ct);
}
