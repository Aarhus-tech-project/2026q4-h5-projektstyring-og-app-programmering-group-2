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

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasPostgresExtension("citext");

        b.Entity<User>().Property(u => u.Email).HasColumnType("citext");
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();

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

            e.ToTable(t => t.HasCheckConstraint("ck_votes_different_posts", "winner_id <> loser_id"));
        });
    }
}
