using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPostRandKeyAndEloIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "rand_key",
                table: "posts",
                type: "double precision",
                nullable: false,
                defaultValueSql: "random()");

            migrationBuilder.CreateIndex(
                name: "ix_posts_elo",
                table: "posts",
                column: "elo",
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_posts_rand_key",
                table: "posts",
                column: "rand_key",
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_posts_elo",
                table: "posts");

            migrationBuilder.DropIndex(
                name: "ix_posts_rand_key",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "rand_key",
                table: "posts");
        }
    }
}
