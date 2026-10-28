using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class PostsController(ILogger<PostsController> logger, BlobServiceClient blobs, PostsRepository postsRepository, MediaService mediaService, TokenGenerator tokenGenerator) : Controller
{
    public record PostRequest(IFormFile File);
    public record VoteRequest(Guid MatchupId, Guid WinnerId);

    private BlobContainerClient Media => blobs.GetBlobContainerClient("media");
    private BlobContainerClient Uploads => blobs.GetBlobContainerClient("uploads");
    
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Post([FromForm]PostRequest postRequest)
    {
        try
        {
            await using var processed = await mediaService.Process(postRequest.File);

            var blob = await Upload(processed.Data, processed.Media.Hash);
            var thumbnailBlob = await Upload(processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

            string accessToken = Request.Headers.Authorization.ToString();
            UserAccessTokenDTO? user = await tokenGenerator.DecodeAccessToken(accessToken);
            if (user == null) throw new UnauthorizedAccessException();
            Post post = await postsRepository.CreatePost(user.Id, processed.Media);

            return StatusCode(202, post.Id);
        }
        catch (RequestFailedException ex)
        {
            logger.LogError(ex, "Blob upload failed: {Status} {Code}", ex.Status, ex.ErrorCode);
            return StatusCode(502, "Upload failed");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating post");
            return StatusCode(500, "Server Error");
        }
    }

    [HttpPost("vote")]
    [Authorize]
    public async Task<IActionResult> Vote(VoteRequest voteRequest)
    {
        return Ok();
    }

    [HttpGet("matchup")]
    [Authorize]
    public async Task<IActionResult> Matchup()
    {
        string accessToken = Request.Headers.Authorization.ToString()["Bearer ".Length..];
        UserAccessTokenDTO? user = await tokenGenerator.DecodeAccessToken(accessToken);
        if (user == null) throw new UnauthorizedAccessException();

        Matchup? matchup = await postsRepository.GetMatchup(user.Id);
        if (matchup == null) return StatusCode(500, "Error Creating matchup");
        
        return Ok(new MatchupDTO(matchup));
    }

    public record RankedPost(Guid Id, string ThumbnailUrl, string ImageUrl, float Elo, int Wins, int Losses);

    [HttpGet("ranking")]
    public async Task<ActionResult<List<RankedPost>>> Ranking([FromQuery] string order = "top")
    {
        List<Post> posts = await postsRepository.GetRanking(order);

        return Ok(posts.Select(p => new RankedPost(p.Id, MediaUrl(p.MediaHash, suffix: "_thumb"), MediaUrl(p.MediaHash),
        p.Elo, p.Wins,p.Losses)).ToList());
    }

    string MediaUrl(byte[] hash, string suffix = "", string extension = ".webp") =>
        Media.GetBlobClient($"{Convert.ToHexStringLower(hash)}{suffix}{extension}").Uri.ToString();

    async Task<BlobClient> Upload(Stream stream, byte[] hash, string suffix = "", string contentType = "image/webp", string extension = ".webp")
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

        return blob;
    }
}