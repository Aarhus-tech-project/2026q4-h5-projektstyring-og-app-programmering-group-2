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

        var originalBlob = UploadOriginal(processed.Original, processed.Media.Hash);
        var processedBlob = await UploadMedia(processed.Proccesed, processed.Media.Hash);
        var thumbnailBlob = await UploadMedia(processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

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

    PublicPostDTO ToDto(Post p)
    {
        return new(p.Id, MediaUrl(p.MediaHash, suffix: "_thumb"), MediaUrl(p.MediaHash), p.Elo, p.Wins, p.Losses, p.CreatedAt);
    }

    string MediaUrl(byte[] hash, string suffix = "", string extension = ".webp")
    {
        return Media.GetBlobClient($"{Convert.ToHexStringLower(hash)}{suffix}{extension}").Uri.ToString();
    }

    async Task<BlobClient> UploadMedia(Stream stream, byte[] hash, string suffix = "", string contentType = "image/webp", string extension = ".webp")
    {
        var blob = Media.GetBlobClient($"{Convert.ToHexStringLower(hash)}{suffix}{extension}");

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

    async Task<BlobClient> UploadOriginal(Stream stream, byte[] hash, string suffix = "", string contentType = "image/webp", string extension = ".webp")
    {
        var blob = Uploads.GetBlobClient($"{Convert.ToHexStringLower(hash)}{suffix}{extension}");

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

        return blob;
    }
}