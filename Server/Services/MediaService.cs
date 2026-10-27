using System.Globalization;
using System.Security.Cryptography;
using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using SkiaSharp;
using ThumbHashes;

namespace Server;

public sealed record ProcessedMedia(Media Media, MemoryStream Data, MemoryStream Thumbnail) : IAsyncDisposable
{
    public async ValueTask DisposeAsync()
    {
        await Data.DisposeAsync();
        await Thumbnail.DisposeAsync();
    }
}

public class MediaService
{
    public async Task<byte[]> Hash(Stream stream)
    {
        var hash = await SHA256.HashDataAsync(stream);
        stream.Position = 0;
        return hash;
    }

    public async Task<ProcessedMedia> Process(IFormFile file, int maxSize = 2048, int thumbnailSize = 400, int quality = 80)
    {
        var exif = ReadExif(file);

        await using var input = file.OpenReadStream();
        using var codec = SKCodec.Create(input) ?? throw new InvalidDataException("Unsupported image format");
        using var source = SKBitmap.Decode(codec);
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
            Hash = await Hash(output),
            Kind = MediaKind.Photo,
            Width = info.Width,
            Height = info.Height,
            Thumbhash = Thumbhash(image),
            OriginalFormat = codec.EncodedFormat.ToString().ToLowerInvariant(),
            OriginalSizeBytes = file.Length,
            CameraMake = exif.Make,
            CameraModel = exif.Model,
            TakenAt = exif.TakenAt,
        };

        return new ProcessedMedia(media, output, Encode(thumbnail, quality));
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

    private static Exif ReadExif(IFormFile file)
    {
        IReadOnlyList<MetadataExtractor.Directory> directories;
        try
        {
            using var stream = file.OpenReadStream();
            directories = ImageMetadataReader.ReadMetadata(stream);
        }
        catch (ImageProcessingException)
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
