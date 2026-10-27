namespace Server.Models
{
    public class Session
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
        public string? RefreshTokenHash { get; set; } = null!;
        public string? DeviceName { get; set; } = null!;
        public string? Platform { get; set; } = null!;
        public string? AppVersion { get; set; } = null!;
        public DateTime? CreatedAt { get; set; }
        public DateTime? LastSeenAt { get; set; }
        public DateTime? RevokedAt { get; set; }
    }
}
