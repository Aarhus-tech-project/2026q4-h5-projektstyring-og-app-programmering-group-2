public enum MediaKind
{
    Photo,
    Video
}

public class Media
{
    public byte[] Hash { get; set; } = null!;
    public MediaKind Kind { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public byte[]? Thumbhash { get; set; }
    public string OriginalFormat { get; set; } = null!;
    public long OriginalSizeBytes { get; set; }
    public string? CameraMake { get; set; }
    public string? CameraModel { get; set; }
    public DateTimeOffset? TakenAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
