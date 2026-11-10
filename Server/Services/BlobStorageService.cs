using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Server.Exceptions;

namespace Server;

public class BlobStorageService(BlobServiceClient blobs)
{
    private const string ThumbnailSuffix = "_thumb";

    private BlobContainerClient Media => blobs.GetBlobContainerClient("media");
    private BlobContainerClient Uploads => blobs.GetBlobContainerClient("uploads");

    public async Task Store(ProcessedMedia processed, CancellationToken ct = default)
    {
        byte[] hash = processed.Media.Hash;

        await Task.WhenAll(
            Upload(Uploads, processed.Original, hash, ct: ct),
            Upload(Media, processed.Proccesed, hash, ct: ct),
            Upload(Media, processed.Thumbnail, hash, ThumbnailSuffix, ct));
    }

    public string ImageUrl(byte[] hash) => Media.GetBlobClient(BlobName(hash)).Uri.ToString();

    public string ThumbnailUrl(byte[] hash) => Media.GetBlobClient(BlobName(hash, ThumbnailSuffix)).Uri.ToString();

    private static string BlobName(byte[] hash, string suffix = "") => $"{Convert.ToHexStringLower(hash)}{suffix}.webp";

    private static async Task Upload(BlobContainerClient container, Stream stream, byte[] hash, string suffix = "", CancellationToken ct = default)
    {
        var blob = container.GetBlobClient(BlobName(hash, suffix));

        try
        {
            await blob.UploadAsync(stream, new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = "image/webp", CacheControl = "public, max-age=31536000, immutable" },
                Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All },
            }, ct);
        }
        catch (RequestFailedException ex) when (ex.ErrorCode == BlobErrorCode.BlobAlreadyExists)
        {
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new BlobUploadInternalServerException(ex);
        }
    }
}
