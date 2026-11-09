public class PostEloChange
{
    public Guid PostId { get; set; }
    public DateTimeOffset Hour { get; set; }
    public float EloChange { get; set; }
}
