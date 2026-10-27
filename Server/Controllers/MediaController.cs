using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Mvc;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class MediaController(BlobServiceClient blobs) : Controller
{
    private BlobContainerClient Media => blobs.GetBlobContainerClient("media");
    private BlobContainerClient Uploads => blobs.GetBlobContainerClient("uploads");

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        var blob = await Upload(Uploads, file);

        return Ok();
    }

    private static async Task<BlobClient> Upload(BlobContainerClient container, IFormFile file)
    {
        var blob = container.GetBlobClient($"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}");
        await using var stream = file.OpenReadStream();
        await blob.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
        return blob;
    }
}