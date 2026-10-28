using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class PostsController(ILogger<PostsController> logger, BlobServiceClient blobs, PostsRepository postsRepository, MediaService mediaService) : Controller
{
    public record PostRequest(IFormFile file, Guid UserId);

    private BlobContainerClient Media => blobs.GetBlobContainerClient("media");
    private BlobContainerClient Uploads => blobs.GetBlobContainerClient("uploads");
    
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Post([FromForm]PostRequest postRequest)
    {
        try
        {
            await using var processed = await mediaService.Process(postRequest.file);

            var blob = await Upload(processed.Data, processed.Media.Hash);
            var thumbnailBlob = await Upload(processed.Thumbnail, processed.Media.Hash, suffix: "_thumb");

            var post = await postsRepository.CreatePost(postRequest.UserId, processed.Media);

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

    public record RankedPost(Guid Id, string ThumbnailUrl, string ImageUrl, float Elo, int Wins, int Losses);

    [HttpGet("ranking")]
    public async Task<ActionResult<List<RankedPost>>> Ranking([FromQuery] string order = "top")
    {
        List<Post> posts = await postsRepository.GetRanking(order);

        return Ok(posts.Select(p => new RankedPost(p.Id, MediaUrl(p.MediaHash, suffix: "_thumb"), MediaUrl(p.MediaHash),
        p.Elo, p.Wins,p.Losses)).ToList());
    }

    // Same naming as Upload: {hash}{suffix}{extension}
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