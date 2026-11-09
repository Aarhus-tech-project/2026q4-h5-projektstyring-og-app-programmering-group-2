using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class PostsController(BlobStorageService storage, PostsRepository postsRepository, MediaService mediaService) : Controller
{
    public record DescriptionRequest(string? Description);
    public record PostRequest(IFormFile File);
    public record VoteRequest(Guid MatchupId, Guid WinnerPostId, Guid LooserPostId);

    private const long MaxUploadBytes = 25 * 1024 * 1024;

    [HttpPost]
    [Authorize]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
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
    public async Task<IActionResult> DeletePost(Guid postId)
    {
        await postsRepository.DeletePost(User.GetUserId(), postId);
        return NoContent();
    }

    [HttpGet("favorites")]
    [Authorize]
    public async Task<ActionResult<List<PublicPostDTO>>> Favorites()
    {
        List<Post> posts = await postsRepository.GetFavorites(User.GetUserId());
        return posts.Select(ToDto).ToList();
    }

    [HttpPost("favorite")]
    [Authorize]
    public async Task<IActionResult> AddFavorite(Guid postId)
    {
        await postsRepository.CreateFavorite(User.GetUserId(), postId);
        return NoContent();
    }

    [HttpDelete("favorite")]
    [Authorize]
    public async Task<IActionResult> DeleteFavorite(Guid postId)
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

        return new MatchupDTO(matchup.Id, ToDto(postA), ToDto(postB), matchup.IssuedAt);
    }

    [HttpGet("ranking")]
    public async Task<ActionResult<List<RankedPostDTO>>> Ranking([FromQuery] RankingPeriod period = RankingPeriod.All, [FromQuery] RankingOrder order = RankingOrder.Top)
    {
        List<Post> posts = await postsRepository.GetRanking(period, order);
        return posts.Select(ToRankedDto).ToList();
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<ActionResult<Profile>> GetProfile()
    {
        Guid userId = User.GetUserId();

        var user = await postsRepository.GetUser(userId);
        if (user == null) return NotFound();
        List<Post> posts = await postsRepository.GetUserPosts(userId);
        int wins = posts.Sum(p => p.Wins);
        int losses = posts.Sum(p => p.Losses);
        float elo = posts.Count == 0 ? 1000 : posts.Max(p => p.Elo);
        var (avatarThumbnailUrl, avatarUrl, avatarThumbhash) = AvatarFields(user);

        return new Profile(user.Username, user.Description, avatarThumbnailUrl, avatarUrl, avatarThumbhash, elo, wins, losses, posts.Select(ToDto).ToList());
    }

    [HttpPut("profile/avatar")]
    [Authorize]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<IActionResult> SetAvatar([FromForm] PostRequest request)
    {
        await using var processed = await mediaService.Process(request.File);
        await storage.Store(processed, HttpContext.RequestAborted);

        await postsRepository.SetAvatar(User.GetUserId(), processed.Media);
        return NoContent();
    }

    [HttpPut("profile/description")]
    [Authorize]
    public async Task<IActionResult> SetDescription(DescriptionRequest request)
    {
        string? description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await postsRepository.SetDescription(User.GetUserId(), description);
        return NoContent();
    }

    PublicPostDTO ToDto(Post p)
    {
        string? thumbhash = p.Media.Thumbhash == null ? null : Convert.ToBase64String(p.Media.Thumbhash);
        return new(p.Id, storage.ThumbnailUrl(p.MediaHash), storage.ImageUrl(p.MediaHash), thumbhash, p.Elo, p.Wins, p.Losses, p.CreatedAt);
    }

    RankedPostDTO ToRankedDto(Post p)
    {
        string? thumbhash = p.Media.Thumbhash == null ? null : Convert.ToBase64String(p.Media.Thumbhash);
        var (avatarThumbnailUrl, avatarUrl, avatarThumbhash) = AvatarFields(p.User);
        return new(p.Id, storage.ThumbnailUrl(p.MediaHash), storage.ImageUrl(p.MediaHash), thumbhash, p.Elo, p.Wins, p.Losses, p.CreatedAt,
            avatarThumbnailUrl, avatarUrl, avatarThumbhash);
    }

    (string? ThumbnailUrl, string? Url, string? Thumbhash) AvatarFields(User user)
    {
        if (user.AvatarHash == null) return (null, null, null);
        string? thumbhash = user.Avatar?.Thumbhash == null ? null : Convert.ToBase64String(user.Avatar.Thumbhash);
        return (storage.ThumbnailUrl(user.AvatarHash), storage.ImageUrl(user.AvatarHash), thumbhash);
    }
}