using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Exceptions;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class PostsController(ILogger<PostsController> logger, BlobServiceClient blobs, PostsRepository postsRepository, MediaService mediaService, TokenService tokenService) : Controller
{
    public record PostRequest(IFormFile File);
    public record VoteRequest(Guid MatchupId, Guid WinnerPostId, Guid LooserPostId);

    private BlobContainerClient Media => blobs.GetBlobContainerClient("media");
    private BlobContainerClient Uploads => blobs.GetBlobContainerClient("uploads");
    
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Post([FromForm]PostRequest postRequest)
    {
        await using var processed = await mediaService.Process(postRequest.File);

        var originalBlob = await Upload(Uploads, processed.Original, processed.Media.Hash);
        var processedBlob = await Upload(Media, processed.Proccesed, processed.Media.Hash);
        var thumbnailBlob = await Upload(Media, processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

        Post post = await postsRepository.CreatePost(User.GetUserId(), processed.Media);

        return StatusCode(202, post.Id);
    }

    [HttpPost("vote")]
    [Authorize]
    public async Task<IActionResult> Vote(VoteRequest voteRequest)
    {
        await postsRepository.SubmitVote(voteRequest);
        return Ok();
    }

    [HttpGet("matchup")]
    [Authorize]
    public async Task<ActionResult<MatchupDTO>> Matchup()
    {
        Matchup matchup = await postsRepository.CreateMatchup(User.GetUserId());

        return new MatchupDTO(matchup.Id, ToDto(matchup.PostA), ToDto(matchup.PostB), matchup.IssuedAt);
    }

    [HttpGet("ranking")]
    public async Task<ActionResult<List<PublicPostDTO>>> Ranking([FromQuery] string order = "top")
    {
        List<Post> posts = await postsRepository.GetRanking(order);
        return posts.Select(ToDto).ToList();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ProfileDTO>> Me()
    {
        Guid userId = User.GetUserId();

        var user = await postsRepository.GetUser(userId);
        if (user == null) return NotFound();
        List<Post> posts = await postsRepository.GetUserPosts(userId);
        int wins = posts.Sum(p => p.Wins);
        int losses = posts.Sum(p => p.Losses);
        float elo = posts.Count == 0 ? 1000 : posts.Max(p => p.Elo);
        string? avatarThumbnailUrl = user.AvatarHash == null ? null : MediaUrl(user.AvatarHash, suffix: "_thumb");
        string? avatarUrl = user.AvatarHash == null ? null : MediaUrl(user.AvatarHash);

        return new ProfileDTO(user.Username, user.Description, avatarThumbnailUrl, avatarUrl, elo, wins, losses, posts.Select(ToDto).ToList());
    }

    [HttpPut("me/avatar")]
    [Authorize]
    public async Task<IActionResult> SetAvatar([FromForm] PostRequest request)
    {
        await using var processed = await mediaService.Process(request.File);

        await Upload(Media, processed.Proccesed, processed.Media.Hash);
        await Upload(Media, processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

        await postsRepository.SetAvatar(User.GetUserId(), processed.Media);
        return NoContent();
    }

    PublicPostDTO ToDto(Post p)
    {
        return new(p.Id, MediaUrl(p.MediaHash, suffix: "_thumb"), MediaUrl(p.MediaHash), p.Elo, p.Wins, p.Losses, p.CreatedAt);
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