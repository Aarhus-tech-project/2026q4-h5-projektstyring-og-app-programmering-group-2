using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAvatar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "avatar_hash",
                table: "users",
                type: "bytea",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_avatar_hash",
                table: "users",
                column: "avatar_hash");

            migrationBuilder.AddForeignKey(
                name: "fk_users_media_avatar_hash",
                table: "users",
                column: "avatar_hash",
                principalTable: "media",
                principalColumn: "hash");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_users_media_avatar_hash",
                table: "users");

            migrationBuilder.DropIndex(
                name: "ix_users_avatar_hash",
                table: "users");

            migrationBuilder.DropColumn(
                name: "avatar_hash",
                table: "users");
        }
    }
}
