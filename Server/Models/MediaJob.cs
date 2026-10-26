public enum MediaJobStatus
{
    Queued,
    Processing,
    Done,
    Failed
}

public class MediaJob
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public byte[]? MediaHash { get; set; }
    public string UploadPath { get; set; } = null!;
    public MediaJobStatus Status { get; set; } = MediaJobStatus.Queued;
    public int Attempts { get; set; }
    public DateTimeOffset? LockedAt { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Media? Media { get; set; }
}