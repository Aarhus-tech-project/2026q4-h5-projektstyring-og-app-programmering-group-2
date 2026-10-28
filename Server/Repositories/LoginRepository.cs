using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Models;
using System.ComponentModel;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;

namespace Server.Repositories;

public class LoginRepository(AppDbContext db)
{
    PasswordHasher<User> PasswordHasher = new PasswordHasher<User>();

    public async Task<User?> Login(UserLoginDTO loginDTO)
    {
        return await GetUserWithUserLoginDTO(loginDTO);
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

    public async Task logOut(Guid sessionId) =>
    await db.Sessions
        .Where(s => s.Id == sessionId)
        .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTime.UtcNow));

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

    public async Task<User?> GetUserWithUserLoginDTO(UserLoginDTO userLoginDTO)
    {
        User? user = ValidEmailSyntax(userLoginDTO.loginString)
            ? await db.Users.FirstOrDefaultAsync(u => u.Email == userLoginDTO.loginString)
            : await db.Users.FirstOrDefaultAsync(u => u.Username == userLoginDTO.loginString);

        if (user == null) return null;

        var result = PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, userLoginDTO.Password);
        return result == PasswordVerificationResult.Failed ? null : user;
    }
}

