using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEloWinsLosses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<float>(
                name: "elo",
                table: "users",
                type: "real",
                nullable: false,
                defaultValue: 1000f);

            migrationBuilder.AddColumn<int>(
                name: "losses",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "wins",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE users AS u
                SET wins = s.wins,
                    losses = s.losses,
                    elo = s.elo
                FROM (
                    SELECT user_id, SUM(wins) AS wins, SUM(losses) AS losses, MAX(elo) AS elo
                    FROM posts
                    WHERE deleted_at IS NULL
                    GROUP BY user_id
                ) AS s
                WHERE u.id = s.user_id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "elo",
                table: "users");

            migrationBuilder.DropColumn(
                name: "losses",
                table: "users");

            migrationBuilder.DropColumn(
                name: "wins",
                table: "users");
        }
    }
}
