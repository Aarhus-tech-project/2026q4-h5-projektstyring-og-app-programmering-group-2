using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class PostEloRandKeyIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_posts_elo",
                table: "posts");

            migrationBuilder.CreateIndex(
                name: "ix_posts_elo_rand_key",
                table: "posts",
                columns: new[] { "elo", "rand_key" },
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_posts_elo_rand_key",
                table: "posts");

            migrationBuilder.CreateIndex(
                name: "ix_posts_elo",
                table: "posts",
                column: "elo",
                filter: "deleted_at IS NULL");
        }
    }
}
