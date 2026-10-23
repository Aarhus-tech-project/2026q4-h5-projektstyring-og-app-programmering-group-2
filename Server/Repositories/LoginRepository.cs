using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.Net.Mail;

namespace Server;

public class LoginRepository(AppDbContext db)
{
    PasswordHasher<User> PasswordHasher = new PasswordHasher<User>();

    public async Task<bool> Login(UserLoginDTO login)
    {
        if (ValidEmailSyntax(login.loginString))
        {
            User? user = db.Users.FirstOrDefault(u => u.Email == login.loginString);
            if (user == null) { return false; }

            PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, login.Password);

            return true;
        }
        else
        {
            User? user = db.Users.FirstOrDefault(u => u.Username == login.loginString);
            if (user == null) { return false; }

            PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, login.Password);

            return true;
        }
    }

    public async Task<bool> Register(UserRegisterDTO login)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = login.Username,
            Email = login.Email,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, login.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> MarkusesEmailTjek(string email) 
    {
        if (await db.Users.AnyAsync(u => u.Email == email))
            return false;

        return true;
    }

    public bool ValidEmailSyntax(string email) 
    {
        if (!MailAddress.TryCreate(email, out var mail) || mail.Address != email)
            return false;

        return true;
    }
}