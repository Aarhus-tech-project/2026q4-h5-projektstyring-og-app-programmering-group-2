using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Server.Models;
using System.Collections.Generic;
using System.Reflection.Emit;
using static System.Net.Mime.MediaTypeNames;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasPostgresExtension("citext");

        b.Entity<User>().Property(u => u.Email).HasColumnType("citext");
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();

        b.Entity<Session>().HasIndex(s => s.RefreshTokenHash).IsUnique();
    }
}