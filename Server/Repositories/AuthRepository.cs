using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Server.Exceptions;

namespace Server.Repositories;

public class AuthRepository(AppDbContext db)
{
    private readonly PasswordHasher<User> passwordHasher = new();

    public async Task<User?> Login(LoginRequest request)
    {
        User? user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null) return null;

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed) return null;

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
            await db.SaveChangesAsync();
        }

        return user;
    }

    public async Task<Guid> Register(RegisterRequest request)
    {
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Username = request.Username,
            Email = request.Email,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "ix_users_email" })
        {
            throw new EmailAlreadyInUseException();
        }

        return user.Id;
    }
}
