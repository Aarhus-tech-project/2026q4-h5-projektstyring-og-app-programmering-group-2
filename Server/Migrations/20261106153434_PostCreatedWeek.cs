using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class PostCreatedWeek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "created_week",
                table: "posts",
                type: "date",
                nullable: false,
                computedColumnSql: "(date_trunc('week', created_at AT TIME ZONE 'UTC'))::date",
                stored: true);

            migrationBuilder.CreateIndex(
                name: "ix_posts_created_week_elo_rand_key",
                table: "posts",
                columns: new[] { "created_week", "elo", "rand_key" },
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_posts_created_week_elo_rand_key",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "created_week",
                table: "posts");
        }
    }
}
