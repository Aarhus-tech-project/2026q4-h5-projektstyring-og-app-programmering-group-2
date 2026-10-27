using System.Security.Cryptography;
using SkiaSharp;

namespace Server;

public class MediaService
{
    public async Task<byte[]> Hash(Stream stream)
    {
        var hash = await SHA256.HashDataAsync(stream);
        stream.Position = 0;
        return hash;
    }

    public async Task<MemoryStream> Process(IFormFile file, int maxSize = 2048, int quality = 80)
    {
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
        surface.Canvas.DrawImage(sourceImage, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));

        using var image = surface.Snapshot();
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
}
