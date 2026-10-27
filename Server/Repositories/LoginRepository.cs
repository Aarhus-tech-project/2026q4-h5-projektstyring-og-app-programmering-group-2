using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Models;
using System.ComponentModel;
using System.Net.Mail;

namespace Server;

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
        if (ValidEmailSyntax(userLoginDTO.loginString))
        {
            User? user = db.Users.FirstOrDefault(u => u.Email == userLoginDTO.loginString);
            if (user == null) { return null; }

            PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, userLoginDTO.Password);

            return user;
        }
        else
        {
            User? user = db.Users.FirstOrDefault(u => u.Username == userLoginDTO.loginString);
            if (user == null) { return null; }

            PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, userLoginDTO.Password);

            return user;
        }
    }

    public async Task<bool> InsertSession(User user, string refreshToken)
    {
        var session = new Session
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshTokenHash = refreshToken,
            DeviceName = null,

        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync();
        return true;
    }
}