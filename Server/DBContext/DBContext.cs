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
    }
}
