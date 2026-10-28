using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddvoteAndMathup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "matchups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    voter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    post_a_id = table.Column<Guid>(type: "uuid", nullable: false),
                    post_b_id = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_matchups", x => x.id);
                    table.CheckConstraint("ck_matchups_different_posts", "post_a_id <> post_b_id");
                    table.ForeignKey(
                        name: "fk_matchups_posts_post_a_id",
                        column: x => x.post_a_id,
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_matchups_posts_post_b_id",
                        column: x => x.post_b_id,
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_matchups_users_voter_id",
                        column: x => x.voter_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "votes",
                columns: table => new
                {
                    matchup_id = table.Column<Guid>(type: "uuid", nullable: false),
                    winner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    loser_id = table.Column<Guid>(type: "uuid", nullable: false),
                    winner_elo_before = table.Column<float>(type: "real", nullable: false),
                    loser_elo_before = table.Column<float>(type: "real", nullable: false),
                    winner_was_a = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_votes", x => x.matchup_id);
                    table.CheckConstraint("ck_votes_different_posts", "winner_id <> loser_id");
                    table.ForeignKey(
                        name: "fk_votes_matchups_matchup_id",
                        column: x => x.matchup_id,
                        principalTable: "matchups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_votes_posts_loser_id",
                        column: x => x.loser_id,
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_votes_posts_winner_id",
                        column: x => x.winner_id,
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_matchups_post_a_id",
                table: "matchups",
                column: "post_a_id");

            migrationBuilder.CreateIndex(
                name: "ix_matchups_post_b_id",
                table: "matchups",
                column: "post_b_id");

            migrationBuilder.CreateIndex(
                name: "ix_matchups_voter_id_issued_at",
                table: "matchups",
                columns: new[] { "voter_id", "issued_at" });

            migrationBuilder.CreateIndex(
                name: "ix_votes_loser_id",
                table: "votes",
                column: "loser_id");

            migrationBuilder.CreateIndex(
                name: "ix_votes_winner_id",
                table: "votes",
                column: "winner_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "votes");

            migrationBuilder.DropTable(
                name: "matchups");
        }
    }
}
