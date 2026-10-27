namespace Server;

public class PostsRepository(AppDbContext db)
{
    public Post CreatePost(Guid userId, byte[] mediaHash)
    {
        Post post = new()
        {
            UserId = userId,
            MediaHash = mediaHash
        };

        return db.Posts.Add(post).Entity;
    }
}