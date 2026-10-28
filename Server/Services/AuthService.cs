using Microsoft.AspNetCore.Mvc;
using static Server.Controllers.LoginController;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Services
{
    public class AuthService(AppDbContext db)
    {
        public async Task<Session?> InsertSession(User user, string refreshToken, string? deviceName, string? platform)
        {
            var session = new Session
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                RefreshTokenHash = Hash(refreshToken),
                DeviceName = deviceName,
                Platform = platform,
                CreatedAt = DateTime.UtcNow,
                LastSeenAt = DateTime.UtcNow
            };

            db.Sessions.Add(session);
            await db.SaveChangesAsync();
            return session;
        }

        public async Task RevokeExistingSessions(Guid userId, string? deviceName, string? platform)
        {
            await db.Sessions
                .Where(s => s.UserId == userId && s.DeviceName == deviceName && s.Platform == platform && s.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTime.UtcNow));
        }

        public async Task<Session?> GetActiveSession(string refreshToken)
        {
            var hash = Hash(refreshToken);
            return await db.Sessions.Include(s => s.User).FirstOrDefaultAsync(s =>
                s.RefreshTokenHash == hash && s.RevokedAt == null && s.LastSeenAt > DateTime.UtcNow.AddDays(-30));
        }

        public async Task RotateSession(Session session, string refreshToken)
        {
            session.RefreshTokenHash = Hash(refreshToken);
            session.LastSeenAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        public static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }
}
