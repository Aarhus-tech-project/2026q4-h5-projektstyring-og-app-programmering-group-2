using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "media",
                columns: table => new
                {
                    hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    width = table.Column<int>(type: "integer", nullable: false),
                    height = table.Column<int>(type: "integer", nullable: false),
                    thumbhash = table.Column<byte[]>(type: "bytea", nullable: true),
                    original_format = table.Column<string>(type: "text", nullable: false),
                    original_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    camera_make = table.Column<string>(type: "text", nullable: true),
                    camera_model = table.Column<string>(type: "text", nullable: true),
                    taken_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_media", x => x.hash);
                });

            migrationBuilder.CreateTable(
                name: "media_jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    media_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    upload_path = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    locked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_media_jobs", x => x.id);
                    table.ForeignKey(
                        name: "fk_media_jobs_media_media_hash",
                        column: x => x.media_hash,
                        principalTable: "media",
                        principalColumn: "hash");
                    table.ForeignKey(
                        name: "fk_media_jobs_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_media_jobs_media_hash",
                table: "media_jobs",
                column: "media_hash");

            migrationBuilder.CreateIndex(
                name: "ix_media_jobs_status_created_at",
                table: "media_jobs",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_media_jobs_user_id",
                table: "media_jobs",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "media_jobs");

            migrationBuilder.DropTable(
                name: "media");
        }
    }
}
