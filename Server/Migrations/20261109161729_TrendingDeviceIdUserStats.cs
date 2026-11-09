using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class TrendingDeviceIdUserStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_posts_user_id",
                table: "posts");

            migrationBuilder.AddColumn<Guid>(
                name: "device_id",
                table: "sessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "post_elo_changes",
                columns: table => new
                {
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hour = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    elo_change = table.Column<float>(type: "real", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_post_elo_changes", x => new { x.hour, x.post_id });
                });

            migrationBuilder.CreateIndex(
                name: "ix_posts_user_id_created_at_id",
                table: "posts",
                columns: new[] { "user_id", "created_at", "id" },
                filter: "deleted_at IS NULL");

            migrationBuilder.Sql("""
                UPDATE users u
                SET wins = s.wins, losses = s.losses, elo = s.elo
                FROM (
                    SELECT u2.id,
                           COALESCE(SUM(p.wins), 0)::int AS wins,
                           COALESCE(SUM(p.losses), 0)::int AS losses,
                           COALESCE(MAX(p.elo), 1000)::real AS elo
                    FROM users u2
                    LEFT JOIN posts p ON p.user_id = u2.id AND p.deleted_at IS NULL
                    GROUP BY u2.id
                ) s
                WHERE u.id = s.id;
                """);

            migrationBuilder.Sql("""
                INSERT INTO post_elo_changes (post_id, hour, elo_change)
                SELECT post_id, hour, SUM(change)::real
                FROM (
                    SELECT v.winner_id AS post_id,
                           date_trunc('hour', v.created_at, 'UTC') AS hour,
                           32 * (1 - 1 / (1 + power(10, (v.loser_elo_before - v.winner_elo_before) / 400.0))) AS change
                    FROM votes v
                    WHERE v.counted_at IS NOT NULL AND v.winner_elo_before IS NOT NULL AND v.loser_elo_before IS NOT NULL
                      AND v.created_at >= now() - interval '48 hours'
                    UNION ALL
                    SELECT v.loser_id,
                           date_trunc('hour', v.created_at, 'UTC'),
                           -32 * (1 - 1 / (1 + power(10, (v.loser_elo_before - v.winner_elo_before) / 400.0)))
                    FROM votes v
                    WHERE v.counted_at IS NOT NULL AND v.winner_elo_before IS NOT NULL AND v.loser_elo_before IS NOT NULL
                      AND v.created_at >= now() - interval '48 hours'
                ) x
                GROUP BY post_id, hour;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "post_elo_changes");

            migrationBuilder.DropIndex(
                name: "ix_posts_user_id_created_at_id",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "device_id",
                table: "sessions");

            migrationBuilder.CreateIndex(
                name: "ix_posts_user_id",
                table: "posts",
                column: "user_id");
        }
    }
}
