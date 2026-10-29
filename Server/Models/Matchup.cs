public class Matchup
{
    public Guid Id { get; set; }
    public Guid VoterId { get; set; }
    public Guid PostAId { get; set; }
    public Guid PostBId { get; set; }
    public DateTimeOffset IssuedAt { get; set; }

    public User Voter { get; set; } = null!;
    public Post PostA { get; set; } = null!;
    public Post PostB { get; set; } = null!;
    public Vote? Vote { get; set; }
}

public record MatchupDTO(Guid Id, PublicPostDTO PostA, PublicPostDTO PostB, DateTimeOffset IssuedAt);
