using Server;
using System.Text.Json.Serialization;

[JsonConverter(typeof(JsonStringEnumConverter<RankingPeriod>))]
public enum RankingPeriod
{
    [JsonStringEnumMemberName("trending")] Trending,
    [JsonStringEnumMemberName("week")] Week,
    [JsonStringEnumMemberName("all")] All
}

[JsonConverter(typeof(JsonStringEnumConverter<RankingOrder>))]
public enum RankingOrder
{
    [JsonStringEnumMemberName("top")] Top,
    [JsonStringEnumMemberName("worst")] Worst
}

public class Post
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public byte[] MediaHash { get; set; } = null!;
    public float Elo { get; set; } = 1000;
    public int Wins { get; set; }
    public int Losses { get; set; }
    public double RandKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateOnly CreatedWeek { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    public User User { get; set; } = null!;
    public Media Media { get; set; } = null!;
}

public record PublicPostDTO(Guid Id, string ThumbnailUrl, string ImageUrl, string? Thumbhash, float Elo, int Wins, int Losses, DateTimeOffset CreatedAt)
{
    internal PublicPostDTO(Post p, BlobStorageService storage)
        : this(p.Id, storage.ThumbnailUrl(p.MediaHash), storage.ImageUrl(p.MediaHash),
            p.Media.Thumbhash is { } thumbhash ? Convert.ToBase64String(thumbhash) : null,
            p.Elo, p.Wins, p.Losses, p.CreatedAt)
    {
    }
}

public record PostPageDTO(List<PublicPostDTO> Posts, Guid? NextCursor);

public record RankedPostDTO(Guid Id, Guid OwnerId, string ThumbnailUrl, string ImageUrl, string? Thumbhash, float Elo, int Wins, int Losses, DateTimeOffset CreatedAt,
    string? AvatarThumbnailUrl, string? AvatarUrl, string? AvatarThumbhash)
{
    internal RankedPostDTO(Post p, BlobStorageService storage)
        : this(p.Id, p.UserId, storage.ThumbnailUrl(p.MediaHash), storage.ImageUrl(p.MediaHash),
            p.Media.Thumbhash is { } thumbhash ? Convert.ToBase64String(thumbhash) : null,
            p.Elo, p.Wins, p.Losses, p.CreatedAt,
            p.User.AvatarHash is { } avatar ? storage.ThumbnailUrl(avatar) : null,
            p.User.AvatarHash is { } avatarImage ? storage.ImageUrl(avatarImage) : null,
            p.User.Avatar?.Thumbhash is { } avatarThumbhash ? Convert.ToBase64String(avatarThumbhash) : null)
    {
    }
}