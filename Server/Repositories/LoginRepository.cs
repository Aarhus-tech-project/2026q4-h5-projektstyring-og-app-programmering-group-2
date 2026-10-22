using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.Net.Mail;

namespace Server;

public class LoginRepository(AppDbContext db)
{
    public async Task<bool> Login(UserLoginDTO login)
    {
        return true;
    }

    public async Task<bool> Register(UserLoginDTO login)
    {
        if (await db.Users.AnyAsync(u => u.Email == login.Email))
            return false;

        if (!MailAddress.TryCreate(login.Email, out var mail) || mail.Address != login.Email)
            return false;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = login.Username,
            Email = login.Email,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, login.PasswordHash);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return true;
    }
}