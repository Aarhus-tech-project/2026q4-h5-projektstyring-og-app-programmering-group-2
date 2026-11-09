using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Server.Models;
using System.Collections.Generic;
using System.Reflection.Emit;
using static System.Net.Mime.MediaTypeNames;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Media> Media => Set<Media>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Matchup> Matchups => Set<Matchup>();
    public DbSet<Vote> Votes => Set<Vote>();
    public DbSet<UserFavorite> UserFavorites => Set<UserFavorite>();
    public DbSet<PostEloChange> PostEloChanges => Set<PostEloChange>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasPostgresExtension("citext");

        b.Entity<User>().Property(u => u.Email).HasColumnType("citext");
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<User>().Property(u => u.Elo).HasDefaultValue(1000f);

        b.Entity<Media>(e =>
        {
            e.HasKey(m => m.Hash);
            e.Property(m => m.Kind).HasConversion<string>();
            e.Property(m => m.CreatedAt).HasDefaultValueSql("now()");
        });

        b.Entity<Session>().HasIndex(s => s.RefreshTokenHash).IsUnique();

        b.Entity<Post>(e =>
        {
            e.Property(p => p.Elo).HasDefaultValue(1000f);
            e.Property(p => p.CreatedAt).HasDefaultValueSql("now()");
            e.Property(p => p.RandKey).HasDefaultValueSql("random()");
            e.Property(p => p.CreatedWeek).HasComputedColumnSql("(date_trunc('week', created_at AT TIME ZONE 'UTC'))::date", stored: true);

            e.HasIndex(p => new { p.Elo, p.RandKey }).HasFilter("deleted_at IS NULL");
            e.HasIndex(p => new { p.CreatedWeek, p.Elo, p.RandKey }).HasFilter("deleted_at IS NULL");
            e.HasIndex(p => p.RandKey).HasFilter("deleted_at IS NULL");
            e.HasIndex(p => new { p.UserId, p.CreatedAt, p.Id }).HasFilter("deleted_at IS NULL");

            e.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId);
            e.HasOne(p => p.Media).WithMany().HasForeignKey(p => p.MediaHash);
        });

        b.Entity<Matchup>(e =>
        {
            e.Property(m => m.IssuedAt).HasDefaultValueSql("now()");

            e.HasOne(m => m.Voter).WithMany().HasForeignKey(m => m.VoterId);
            e.HasOne(m => m.PostA).WithMany().HasForeignKey(m => m.PostAId);
            e.HasOne(m => m.PostB).WithMany().HasForeignKey(m => m.PostBId);

            e.HasIndex(m => new { m.VoterId, m.IssuedAt });
            e.ToTable(t => t.HasCheckConstraint("ck_matchups_different_posts", "post_a_id <> post_b_id"));
        });

        b.Entity<Vote>(e =>
        {
            e.HasKey(v => v.MatchupId);
            e.Property(v => v.CreatedAt).HasDefaultValueSql("now()");

            e.HasOne(v => v.Matchup).WithOne(m => m.Vote).HasForeignKey<Vote>(v => v.MatchupId);
            e.HasOne(v => v.Winner).WithMany().HasForeignKey(v => v.WinnerId);
            e.HasOne(v => v.Loser).WithMany().HasForeignKey(v => v.LoserId);

            e.HasIndex(v => v.CreatedAt).HasFilter("counted_at IS NULL");

            e.ToTable(t => t.HasCheckConstraint("ck_votes_different_posts", "winner_id <> loser_id"));
        });

        b.Entity<UserFavorite>(e =>
        {
            // One row per user and post, so a post can't be favorited twice by the same user
            e.HasKey(f => new { f.UserId, f.PostId });
            e.Property(f => f.CreatedAt).HasDefaultValueSql("now()");

            e.HasOne(f => f.User).WithMany().HasForeignKey(f => f.UserId);
            e.HasOne(f => f.Post).WithMany().HasForeignKey(f => f.PostId);

            // The key covers lookups by user; this covers "who favorited this post"
            e.HasIndex(f => f.PostId);
        });

        b.Entity<PostEloChange>().HasKey(c => new { c.Hour, c.PostId });
    }
}
