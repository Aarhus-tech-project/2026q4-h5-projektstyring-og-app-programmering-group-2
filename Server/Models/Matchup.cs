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

public class MatchupDTO(Matchup matchup)
{
    public Guid Id { get; set; } = matchup.Id;
    public Guid VoterId { get; set; } = matchup.VoterId;
    public Guid PostAId { get; set; } = matchup.PostAId;
    public Guid PostBId { get; set; } = matchup.PostBId;
    public DateTimeOffset IssuedAt { get; set; } = matchup.IssuedAt;
}
