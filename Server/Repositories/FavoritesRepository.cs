using Microsoft.EntityFrameworkCore;
using Server.Exceptions;

namespace Server.Repositories;

public class FavoritesRepository(AppDbContext db)
{
    public async Task<List<Post>> GetFavorites(Guid userId)
    {
        return await db.UserFavorites
            .AsNoTracking()
            .Where(f => f.UserId == userId && f.Post.DeletedAt == null)
            .OrderByDescending(f => f.CreatedAt)
            .Include(f => f.Post).ThenInclude(p => p.Media)
            .Select(f => f.Post)
            .ToListAsync();
    }

    public async Task CreateFavorite(Guid userId, Guid postId)
    {
        int inserted;
        try
        {
            inserted = await db.Database.ExecuteSqlAsync($"""
                INSERT INTO user_favorites (user_id, post_id)
                SELECT {userId}, p.id
                FROM posts p
                WHERE p.id = {postId} AND p.deleted_at IS NULL
                ON CONFLICT (user_id, post_id) DO NOTHING
                """);
        }
        catch (Exception ex)
        {
            throw new FailedToCreateInDatabaseException(ex);
        }

        if (inserted == 1) return;

        if (!await db.Posts.AnyAsync(p => p.Id == postId && p.DeletedAt == null))
            throw new PostDoesntExistException();

    }

    public async Task DeleteFavorite(Guid userId, Guid postId)
    {
        await db.UserFavorites
            .Where(f => f.UserId == userId && f.PostId == postId)
            .ExecuteDeleteAsync();
    }
}
