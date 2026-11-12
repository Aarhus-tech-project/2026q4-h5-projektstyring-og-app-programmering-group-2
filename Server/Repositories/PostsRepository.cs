using Microsoft.EntityFrameworkCore;
using Server.Exceptions;

namespace Server.Repositories;

public class PostsRepository(AppDbContext db, MediaRepository mediaRepository)
{
    public async Task<Post> CreatePost(Guid userId, Media media)
    {
        try
        {
            await mediaRepository.InsertIfMissing(media);

            Post post = new()
            {
                UserId = userId,
                MediaHash = media.Hash
            };

            db.Posts.Add(post);
            await db.SaveChangesAsync();
            return post;
        }
        catch (System.Exception ex)
        {
            throw new FailedToCreateInDatabaseException(ex);
        }
    }

    public async Task DeletePost(Guid userId, Guid postId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();

        int updated = await db.Posts
            .Where(p => p.Id == postId && p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.DeletedAt, p => p.DeletedAt ?? DateTimeOffset.UtcNow));

        if (updated == 0) throw new PostDoesntExistException();

        await UserStats.Recompute(db, [userId]);
        await tx.CommitAsync();
    }
}
