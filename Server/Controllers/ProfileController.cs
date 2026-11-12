using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Repositories;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProfileController(BlobStorageService storage, ProfileRepository profileRepository, MediaService mediaService, ILogger<ProfileController> logger) : ControllerBase
{
    public record DescriptionRequest(string? Description);
    public record AvatarRequest(IFormFile File);

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<Profile>> GetProfile()
    {
        var user = await profileRepository.GetUser(User.GetUserId());
        if (user == null) return NotFound();
        logger.LogInformation("User {UserId} requests profile", User.GetUserId());
        return new Profile(user, storage);
    }

    [HttpGet("{userId:guid}")]
    public async Task<ActionResult<Profile>> GetUserProfile(Guid userId)
    {
        var user = await profileRepository.GetUser(userId);
        if (user == null) return NotFound();
        return new Profile(user, storage);
    }

    [HttpGet("posts")]
    [Authorize]
    public async Task<ActionResult<PostPageDTO>> GetProfilePosts([FromQuery] Guid? before = null)
    {
        var (posts, nextCursor) = await profileRepository.GetUserPosts(User.GetUserId(), before);
        logger.LogInformation("User {UserId} requests profile posts", User.GetUserId());
        return new PostPageDTO(posts.Select(p => new PublicPostDTO(p, storage)).ToList(), nextCursor);
    }

    [HttpGet("{userId:guid}/posts")]
    public async Task<ActionResult<PostPageDTO>> GetUserProfilePosts(Guid userId, [FromQuery] Guid? before = null)
    {
        var (posts, nextCursor) = await profileRepository.GetUserPosts(userId, before);
        return new PostPageDTO(posts.Select(p => new PublicPostDTO(p, storage)).ToList(), nextCursor);
    }

    [HttpPut("avatar")]
    [Authorize]
    [RequestSizeLimit(MediaService.MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MediaService.MaxUploadBytes)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetAvatar([FromForm] AvatarRequest request)
    {
        await using var processed = await mediaService.Process(request.File);
        await storage.Store(processed, HttpContext.RequestAborted);

        await profileRepository.SetAvatar(User.GetUserId(), processed.Media);
        return NoContent();
    }

    [HttpPut("description")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetDescription(DescriptionRequest request)
    {
        string? description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await profileRepository.SetDescription(User.GetUserId(), description);
        logger.LogInformation("User {UserId} updated its description", User.GetUserId());
        return NoContent();
    }
}
