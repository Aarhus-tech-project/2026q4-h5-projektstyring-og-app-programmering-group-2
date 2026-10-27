public class Post
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public byte[] MediaHash { get; set; } = null!;
    public float Elo { get; set; } = 1000;
    public int Wins { get; set; }
    public int Losses { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    public User User { get; set; } = null!;
    public Media Media { get; set; } = null!;
}

public class PublicPostDTO (Post post)
{
    public byte[] MediaHash { get; set; } = null!;
    public float Elo { get; set; } = post.Elo;
    public int Wins { get; set; } = post.Wins;
    public int Losses { get; set; } = post.Losses;
    public DateTimeOffset CreatedAt { get; set; } = post.CreatedAt;
}
