using Microsoft.EntityFrameworkCore;

namespace Server;

public class PostsRepository(AppDbContext db)
{
    public async Task<Post> CreatePost(Guid userId, Media media)
    {
        if (!await db.Media.AnyAsync(m => m.Hash == media.Hash))
            db.Media.Add(media);

        Post post = new()
        {
            UserId = userId,
            MediaHash = media.Hash
        };

        db.Posts.Add(post);
        await db.SaveChangesAsync();
        return post;
    }
}
