public class Vote
{
    public Guid MatchupId { get; set; }
    public Guid WinnerId { get; set; }
    public Guid LoserId { get; set; }
    public bool WinnerWasA { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CountedAt { get; set; }
    public float? WinnerEloBefore { get; set; }
    public float? LoserEloBefore { get; set; }

    public Matchup Matchup { get; set; } = null!;
    public Post Winner { get; set; } = null!;
    public Post Loser { get; set; } = null!;
}
