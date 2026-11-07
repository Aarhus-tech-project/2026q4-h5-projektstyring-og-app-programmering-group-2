using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Exceptions;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class PostsController(ILogger<PostsController> logger, BlobServiceClient blobs, PostsRepository postsRepository, MediaService mediaService) : Controller
{
    public record DescriptionRequest(string? Description);
    public record PostRequest(IFormFile File);
    public record VoteRequest(Guid MatchupId, Guid WinnerPostId, Guid LooserPostId);

    private BlobContainerClient Media => blobs.GetBlobContainerClient("media");
    private BlobContainerClient Uploads => blobs.GetBlobContainerClient("uploads");

    private const long MaxUploadBytes = 25 * 1024 * 1024;

    [HttpPost]
    [Authorize]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<IActionResult> AddPost([FromForm]PostRequest postRequest)
    {
        await using var processed = await mediaService.Process(postRequest.File);

        var originalBlob = await Upload(Uploads, processed.Original, processed.Media.Hash);
        var processedBlob = await Upload(Media, processed.Proccesed, processed.Media.Hash);
        var thumbnailBlob = await Upload(Media, processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

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

        await Upload(Uploads, processed.Original, processed.Media.Hash);
        await Upload(Media, processed.Proccesed, processed.Media.Hash);
        await Upload(Media, processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

        await postsRepository.SetAvatar(User.GetUserId(), processed.Media);
        return NoContent();
    }

    [HttpPut("profile/description")]
    [Authorize]
    public async Task<IActionResult> SetDescription(DescriptionRequest request)
    {
        string? description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        if (description?.Length > 250) return BadRequest("Description can be at most 250 characters");

        await postsRepository.SetDescription(User.GetUserId(), description);
        return NoContent();
    }

    PublicPostDTO ToDto(Post p)
    {
        string? thumbhash = p.Media.Thumbhash == null ? null : Convert.ToBase64String(p.Media.Thumbhash);
        return new(p.Id, MediaUrl(p.MediaHash, suffix: "_thumb"), MediaUrl(p.MediaHash), thumbhash, p.Elo, p.Wins, p.Losses, p.CreatedAt);
    }

    RankedPostDTO ToRankedDto(Post p)
    {
        string? thumbhash = p.Media.Thumbhash == null ? null : Convert.ToBase64String(p.Media.Thumbhash);
        var (avatarThumbnailUrl, avatarUrl, avatarThumbhash) = AvatarFields(p.User);
        return new(p.Id, MediaUrl(p.MediaHash, suffix: "_thumb"), MediaUrl(p.MediaHash), thumbhash, p.Elo, p.Wins, p.Losses, p.CreatedAt,
            avatarThumbnailUrl, avatarUrl, avatarThumbhash);
    }

    (string? ThumbnailUrl, string? Url, string? Thumbhash) AvatarFields(User user)
    {
        if (user.AvatarHash == null) return (null, null, null);
        string? thumbhash = user.Avatar?.Thumbhash == null ? null : Convert.ToBase64String(user.Avatar.Thumbhash);
        return (MediaUrl(user.AvatarHash, suffix: "_thumb"), MediaUrl(user.AvatarHash), thumbhash);
    }

    string MediaUrl(byte[] hash, string suffix = "", string extension = ".webp")
    {
        return Media.GetBlobClient($"{Convert.ToHexStringLower(hash)}{suffix}{extension}").Uri.ToString();
    }

    async Task<BlobClient> Upload(BlobContainerClient client, Stream stream, byte[] hash, string suffix = "", string contentType = "image/webp", string extension = ".webp")
    {
        var blob = client.GetBlobClient($"{Convert.ToHexStringLower(hash)}{suffix}{extension}");

        try
        {
            await blob.UploadAsync(stream, new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = contentType },
                Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All },
            });
        }
        catch (RequestFailedException ex) when (ex.ErrorCode == BlobErrorCode.BlobAlreadyExists)
        {
            
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Blob upload failed");
            throw new BlobUploadInternalServerException();
        }

        return blob;
    }
}