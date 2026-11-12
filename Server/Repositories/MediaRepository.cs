using Microsoft.EntityFrameworkCore;

namespace Server.Repositories;

public class MediaRepository(AppDbContext db)
{
    public async Task InsertIfMissing(Media media)
    {
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO media (hash, kind, width, height, thumbhash, original_format, original_size_bytes, camera_make, camera_model, taken_at)
            VALUES ({media.Hash}, {media.Kind.ToString()}, {media.Width}, {media.Height}, {media.Thumbhash}, {media.OriginalFormat},
                    {media.OriginalSizeBytes}, {media.CameraMake}, {media.CameraModel}, {media.TakenAt})
            ON CONFLICT (hash) DO NOTHING
            """);
    }
}
