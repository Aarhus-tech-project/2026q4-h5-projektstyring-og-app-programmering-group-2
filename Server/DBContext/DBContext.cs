using Microsoft.EntityFrameworkCore;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Media> Media => Set<Media>();

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
    }
}
