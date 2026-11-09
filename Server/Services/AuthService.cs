using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Services;

public class AuthService(AppDbContext db)
{
    private static readonly TimeSpan SessionIdleLimit = TimeSpan.FromDays(30);

    public async Task<Session> InsertSession(User user, string refreshToken, string deviceName, string platform)
    {
        var session = new Session
        {
            Id = Guid.CreateVersion7(),
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

    public async Task<Session?> GetActiveSession(string refreshToken)
    {
        var hash = Hash(refreshToken);
        var idleCutoff = DateTime.UtcNow - SessionIdleLimit;

        return await db.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.RefreshTokenHash == hash && s.RevokedAt == null && s.LastSeenAt > idleCutoff);
    }

    public async Task RotateSession(Session session, string newRefreshToken)
    {
        session.RefreshTokenHash = Hash(newRefreshToken);
        session.LastSeenAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public Task<int> RevokeSession(Guid userId, Guid sessionId) =>
        Revoke(db.Sessions.Where(s => s.Id == sessionId && s.UserId == userId));

    public Task<int> RevokeDeviceSessions(Guid userId, string deviceName, string platform) =>
        Revoke(db.Sessions.Where(s => s.UserId == userId && s.DeviceName == deviceName && s.Platform == platform));

    public Task<int> RevokeAllSessions(Guid userId) =>
        Revoke(db.Sessions.Where(s => s.UserId == userId));

    private static Task<int> Revoke(IQueryable<Session> sessions) =>
        sessions
            .Where(s => s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTime.UtcNow));

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
