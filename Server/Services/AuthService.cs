using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Services;

public class AuthService(AppDbContext db)
{
    private static readonly TimeSpan SessionIdleLimit = TimeSpan.FromDays(30);

    public async Task<Session> InsertSession(User user, string refreshToken, Guid deviceId, string deviceName, string platform)
    {
        var session = new Session
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            RefreshTokenHash = Hash(refreshToken),
            DeviceId = deviceId,
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

    public async Task<bool> RotateSession(Session session, string newRefreshToken)
    {
        var newHash = Hash(newRefreshToken);
        var now = DateTime.UtcNow;

        int updated = await db.Sessions
            .Where(s => s.Id == session.Id && s.RefreshTokenHash == session.RefreshTokenHash && s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.RefreshTokenHash, newHash)
                .SetProperty(x => x.LastSeenAt, now));

        return updated == 1;
    }

    public Task<int> RevokeSession(Guid userId, Guid sessionId) =>
        Revoke(db.Sessions.Where(s => s.Id == sessionId && s.UserId == userId));

    public Task<int> RevokeDeviceSessions(Guid userId, Guid deviceId) =>
        Revoke(db.Sessions.Where(s => s.UserId == userId && s.DeviceId == deviceId));

    public Task<int> RevokeAllSessions(Guid userId) =>
        Revoke(db.Sessions.Where(s => s.UserId == userId));

    private static Task<int> Revoke(IQueryable<Session> sessions) =>
        sessions
            .Where(s => s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTime.UtcNow));

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
