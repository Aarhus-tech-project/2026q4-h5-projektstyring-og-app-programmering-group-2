using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Server.Repositories;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class PostsController(BlobStorageService storage, PostsRepository postsRepository, FavoritesRepository favoritesRepository, MediaService mediaService, ILogger<PostsController> logger) : ControllerBase
{
    public record PostRequest(IFormFile File, float? CropX, float? CropY, float? CropSize);

    [HttpPost]
    [Authorize]
    [RequestSizeLimit(MediaService.MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MediaService.MaxUploadBytes)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<Guid>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<Guid>> AddPost([FromForm]PostRequest postRequest)
    {
        SquareCrop? crop = postRequest is { CropX: { } x, CropY: { } y, CropSize: { } size } ? new(x, y, size) : null;
        await using var processed = await mediaService.Process(postRequest.File, square: true, crop);
        await storage.Store(processed, HttpContext.RequestAborted);
        logger.LogInformation("User {UserId} added post {post}", User.GetUserId(), postRequest.File.FileName);

        Post post = await postsRepository.CreatePost(User.GetUserId(), processed.Media);

        return StatusCode(202, post.Id);
    }

    [HttpDelete]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeletePost([FromQuery, BindRequired] Guid postId)
    {
        await postsRepository.DeletePost(User.GetUserId(), postId);
        logger.LogInformation("User {UserId} deleted post {Platform}", User.GetUserId(), postId);
        return NoContent();
    }

    [HttpGet("favorites")]
    [Authorize]
    public async Task<ActionResult<List<PublicPostDTO>>> Favorites()
    {
        List<Post> posts = await favoritesRepository.GetFavorites(User.GetUserId());
        logger.LogInformation("User {UserId} requests favorite posts", User.GetUserId());
        return posts.Select(p => new PublicPostDTO(p, storage)).ToList();
    }

    [HttpPost("favorites")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AddFavorite([FromQuery, BindRequired] Guid postId)
    {
        await favoritesRepository.CreateFavorite(User.GetUserId(), postId);
        logger.LogInformation("User {UserId} added post {PostId} to favorites", User.GetUserId(), postId);
        return NoContent();
    }

    [HttpDelete("favorites")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteFavorite([FromQuery, BindRequired] Guid postId)
    {
        await favoritesRepository.DeleteFavorite(User.GetUserId(), postId);
        logger.LogInformation("User {UserId} deleted post {PostId} from favorites", User.GetUserId(), postId);
        return NoContent();
    }
}
