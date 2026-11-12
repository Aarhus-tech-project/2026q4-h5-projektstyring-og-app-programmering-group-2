using Microsoft.EntityFrameworkCore;

namespace Server.Repositories;

public class ProfileRepository(AppDbContext db, MediaRepository mediaRepository)
{
    public async Task<User?> GetUser(Guid userId)
    {
        return await db.Users.AsNoTracking().Include(u => u.Avatar).FirstOrDefaultAsync(u => u.Id == userId);
    }

    public const int UserPostsPageSize = 30;

    public async Task<(List<Post> Posts, Guid? NextCursor)> GetUserPosts(Guid userId, Guid? before)
    {
        IQueryable<Post> posts = before is Guid cursor
            ? db.Posts.FromSql($"""
                SELECT * FROM posts
                WHERE user_id = {userId} AND deleted_at IS NULL
                  AND (created_at, id) < (SELECT c.created_at, c.id FROM posts c WHERE c.id = {cursor} AND c.user_id = {userId})
                """)
            : db.Posts.Where(p => p.UserId == userId && p.DeletedAt == null);

        var page = await posts
            .AsNoTracking()
            .Include(p => p.Media)
            .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Take(UserPostsPageSize + 1)
            .ToListAsync();

        if (page.Count <= UserPostsPageSize) return (page, null);

        page.RemoveAt(UserPostsPageSize);
        return (page, page[^1].Id);
    }

    public async Task SetAvatar(Guid userId, Media media)
    {
        await mediaRepository.InsertIfMissing(media);

        await db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.AvatarHash, media.Hash));
    }

    public async Task SetDescription(Guid userId, string? description)
    {
        await db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Description, description));
    }
}
