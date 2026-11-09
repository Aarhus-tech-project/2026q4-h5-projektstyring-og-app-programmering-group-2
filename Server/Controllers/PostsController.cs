using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Server;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class PostsController(BlobStorageService storage, PostsRepository postsRepository, MediaService mediaService) : Controller
{
    public record DescriptionRequest(string? Description);
    public record PostRequest(IFormFile File);
    public record VoteRequest(Guid MatchupId, Guid WinnerPostId, Guid LoserPostId);

    private const long MaxUploadBytes = 25 * 1024 * 1024;

    [HttpPost]
    [Authorize]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<Guid>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<Guid>> AddPost([FromForm]PostRequest postRequest)
    {
        await using var processed = await mediaService.Process(postRequest.File);
        await storage.Store(processed, HttpContext.RequestAborted);

        Post post = await postsRepository.CreatePost(User.GetUserId(), processed.Media);

        return StatusCode(202, post.Id);
    }

    [HttpDelete]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeletePost([FromQuery, BindRequired] Guid postId)
    {
        await postsRepository.DeletePost(User.GetUserId(), postId);
        return NoContent();
    }

    [HttpGet("favorites")]
    [Authorize]
    public async Task<ActionResult<List<PublicPostDTO>>> Favorites()
    {
        List<Post> posts = await postsRepository.GetFavorites(User.GetUserId());
        return posts.Select(p => new PublicPostDTO(p, storage)).ToList();
    }

    [HttpPost("favorite")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AddFavorite([FromQuery, BindRequired] Guid postId)
    {
        await postsRepository.CreateFavorite(User.GetUserId(), postId);
        return NoContent();
    }

    [HttpDelete("favorite")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteFavorite([FromQuery, BindRequired] Guid postId)
    {
        await postsRepository.DeleteFavorite(User.GetUserId(), postId);
        return NoContent();
    }

    [HttpPost("vote")]
    [Authorize]
    public async Task<IActionResult> Vote(VoteRequest voteRequest)
    {
        await postsRepository.SubmitVote(User.GetUserId(), voteRequest);
        return Ok();
    }

    [HttpGet("matchup")]
    [Authorize]
    public async Task<ActionResult<MatchupDTO>> Matchup()
    {
        var (matchup, postA, postB) = await postsRepository.GetOrCreateMatchup(User.GetUserId());

        return new MatchupDTO(matchup.Id, new PublicPostDTO(postA, storage), new PublicPostDTO(postB, storage), matchup.IssuedAt);
    }

    [HttpGet("ranking")]
    public async Task<ActionResult<List<RankedPostDTO>>> Ranking([FromQuery] RankingPeriod period = RankingPeriod.All, [FromQuery] RankingOrder order = RankingOrder.Top)
    {
        List<Post> posts = await postsRepository.GetRanking(period, order);
        return posts.Select(p => new RankedPostDTO(p, storage)).ToList();
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<ActionResult<Profile>> GetProfile()
    {
        Guid userId = User.GetUserId();

        var user = await postsRepository.GetUser(userId);
        if (user == null) return NotFound();
        var (avatarThumbnailUrl, avatarUrl, avatarThumbhash) = AvatarFields(user);

        return new Profile(user.Username, user.Description, avatarThumbnailUrl, avatarUrl, avatarThumbhash, user.Elo, user.Wins, user.Losses);
    }

    [HttpGet("profile/posts")]
    [Authorize]
    public async Task<ActionResult<PostPageDTO>> GetProfilePosts([FromQuery] Guid? before = null)
    {
        var (posts, nextCursor) = await postsRepository.GetUserPosts(User.GetUserId(), before);
        return new PostPageDTO(posts.Select(p => new PublicPostDTO(p, storage)).ToList(), nextCursor);
    }

    [HttpPut("profile/avatar")]
    [Authorize]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetAvatar([FromForm] PostRequest request)
    {
        await using var processed = await mediaService.Process(request.File);
        await storage.Store(processed, HttpContext.RequestAborted);

        await postsRepository.SetAvatar(User.GetUserId(), processed.Media);
        return NoContent();
    }

    [HttpPut("profile/description")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetDescription(DescriptionRequest request)
    {
        string? description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await postsRepository.SetDescription(User.GetUserId(), description);
        return NoContent();
    }

    (string? ThumbnailUrl, string? Url, string? Thumbhash) AvatarFields(User user)
    {
        if (user.AvatarHash == null) return (null, null, null);
        string? thumbhash = user.Avatar?.Thumbhash == null ? null : Convert.ToBase64String(user.Avatar.Thumbhash);
        return (storage.ThumbnailUrl(user.AvatarHash), storage.ImageUrl(user.AvatarHash), thumbhash);
    }
}