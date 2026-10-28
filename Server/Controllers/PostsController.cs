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