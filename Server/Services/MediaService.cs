using System.Globalization;
using System.Security.Cryptography;
using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using Server.Exceptions;
using SkiaSharp;
using ThumbHashes;

namespace Server;

public sealed record ProcessedMedia(Media Media, Stream Original, MemoryStream Proccesed, MemoryStream Thumbnail) : IAsyncDisposable
{
    public async ValueTask DisposeAsync()
    {
        await Original.DisposeAsync();
        await Proccesed.DisposeAsync();
        await Thumbnail.DisposeAsync();
    }
}

public class MediaService
{
    private const long MaxPixels = 50_000_000;
    private static readonly SemaphoreSlim ProcessingSlots = new(Environment.ProcessorCount);

    public async Task<ProcessedMedia> Process(IFormFile file, int maxSize = 2048, int thumbnailSize = 400, int quality = 80)
    {
        // Read the upload once. Streams from file.OpenReadStream() share one underlying buffer,
        // so reading two of them throws "The inner stream position has changed unexpectedly".
        byte[] bytes;
        using (var buffer = new MemoryStream())
        {
            await file.CopyToAsync(buffer);
            bytes = buffer.ToArray();
        }

        var exif = ReadExif(bytes);

        using var codec = SKCodec.Create(new MemoryStream(bytes, writable: false)) ?? throw new UnsupportedImageException();
        if ((long)codec.Info.Width * codec.Info.Height > MaxPixels)
            throw new ImageTooLargeException();

        await ProcessingSlots.WaitAsync();
        try
        {
            return Process(bytes, file.Length, exif, codec, maxSize, thumbnailSize, quality);
        }
        finally
        {
            ProcessingSlots.Release();
        }
    }

    private static ProcessedMedia Process(byte[] bytes, long originalSize, Exif exif, SKCodec codec, int maxSize, int thumbnailSize, int quality)
    {
        using var source = SKBitmap.Decode(codec) ?? throw new UnsupportedImageException();
        using var sourceImage = SKImage.FromBitmap(source);

        // Bake the EXIF orientation into the pixels, since the WebP encoder writes no EXIF
        var origin = codec.EncodedOrigin;
        var rotated = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var width = rotated ? source.Height : source.Width;
        var height = rotated ? source.Width : source.Height;

        var scale = Math.Min(1f, (float)maxSize / Math.Max(width, height));
        var info = new SKImageInfo(Math.Max(1, (int)Math.Round(width * scale)), Math.Max(1, (int)Math.Round(height * scale)));

        using var surface = SKSurface.Create(info);
        surface.Canvas.Scale(scale);
        surface.Canvas.Concat(OrientationMatrix(origin, source.Width, source.Height));
        surface.Canvas.DrawImage(sourceImage, 0, 0, Sampling);

        using var image = surface.Snapshot();
        using var thumbnail = Resize(image, thumbnailSize);

        var output = Encode(image, quality);

        var media = new Media
        {
            Hash = SHA256.HashData(bytes),
            Kind = MediaKind.Photo,
            Width = info.Width,
            Height = info.Height,
            Thumbhash = Thumbhash(image),
            OriginalFormat = codec.EncodedFormat.ToString().ToLowerInvariant(),
            OriginalSizeBytes = originalSize,
            CameraMake = exif.Make,
            CameraModel = exif.Model,
            TakenAt = exif.TakenAt,
        };

        return new ProcessedMedia(media, new MemoryStream(bytes, writable: false), output, Encode(thumbnail, quality));
    }

    private static readonly SKSamplingOptions Sampling = new(SKFilterMode.Linear, SKMipmapMode.Linear);

    private static SKImage Resize(SKImage image, int maxSize)
    {
        var scale = Math.Min(1f, (float)maxSize / Math.Max(image.Width, image.Height));
        var info = new SKImageInfo(Math.Max(1, (int)Math.Round(image.Width * scale)), Math.Max(1, (int)Math.Round(image.Height * scale)));

        using var surface = SKSurface.Create(info);
        surface.Canvas.Scale(scale);
        surface.Canvas.DrawImage(image, 0, 0, Sampling);
        return surface.Snapshot();
    }

    private static MemoryStream Encode(SKImage image, int quality)
    {
        using var data = image.Encode(SKEncodedImageFormat.Webp, quality);
        var output = new MemoryStream();
        data.SaveTo(output);
        output.Position = 0;
        return output;
    }

    private static SKMatrix OrientationMatrix(SKEncodedOrigin origin, int w, int h) => origin switch
    {
        SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
        SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
        SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
        SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightTop => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
        SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),
        _ => SKMatrix.Identity,
    };

    // ThumbHash only accepts images up to 100x100, as unpremultiplied RGBA
    private static byte[] Thumbhash(SKImage image)
    {
        var scale = Math.Min(1f, 100f / Math.Max(image.Width, image.Height));
        var info = new SKImageInfo(
            Math.Max(1, (int)Math.Round(image.Width * scale)),
            Math.Max(1, (int)Math.Round(image.Height * scale)),
            SKColorType.Rgba8888,
            SKAlphaType.Unpremul);

        using var thumb = new SKBitmap(info);
        image.ScalePixels(thumb.PeekPixels(), Sampling);
        return ThumbHash.FromImage(info.Width, info.Height, thumb.GetPixelSpan()).Hash.ToArray();
    }

    private record Exif(string? Make, string? Model, DateTimeOffset? TakenAt);

    private static Exif ReadExif(byte[] bytes)
    {
        IReadOnlyList<MetadataExtractor.Directory> directories;
        try
        {
            using var stream = new MemoryStream(bytes, writable: false);
            directories = ImageMetadataReader.ReadMetadata(stream);
        }
        catch (Exception e) when (e is ImageProcessingException or IOException)
        {
            return new Exif(null, null, null);
        }

        var ifd0 = directories.OfType<ExifIfd0Directory>().FirstOrDefault();
        var subIfd = directories.OfType<ExifSubIfdDirectory>().FirstOrDefault();

        DateTimeOffset? takenAt = null;
        if (subIfd != null && subIfd.TryGetDateTime(ExifDirectoryBase.TagDateTimeOriginal, out var local))
        {
            // DateTimeOriginal is the camera's local time; OffsetTimeOriginal (e.g. "+02:00") says which zone, treat it as UTC if missing
            var offset = ParseOffset(subIfd.GetString(ExifDirectoryBase.TagTimeZoneOriginal)) ?? TimeSpan.Zero;
            takenAt = new DateTimeOffset(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), offset).ToUniversalTime();
        }

        return new Exif(Clean(ifd0?.GetString(ExifDirectoryBase.TagMake)), Clean(ifd0?.GetString(ExifDirectoryBase.TagModel)), takenAt);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim('\0', ' ');

    private static TimeSpan? ParseOffset(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var negative = value.StartsWith('-');
        return TimeSpan.TryParseExact(value.TrimStart('+', '-'), @"hh\:mm", CultureInfo.InvariantCulture, out var offset)
            ? (negative ? -offset : offset)
            : null;
    }
}
