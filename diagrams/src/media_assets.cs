#:package SkiaSharp@4.153.1
#:package ThumbHash@2.1.1

using System.Text.Json;
using System.Text.Json.Nodes;
using SkiaSharp;
using ThumbHashes;

var sampling = new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear);
var input = args[0];
var outDir = Directory.CreateDirectory(args.Length > 1 ? args[1] : Path.Combine("diagrams", "assets")).FullName;

var bytes = File.ReadAllBytes(input);
using var codec = SKCodec.Create(new MemoryStream(bytes, writable: false)) ?? throw new Exception($"cannot decode {input}");
using var source = SKBitmap.Decode(codec);
using var sourceImage = SKImage.FromBitmap(source);

var origin = codec.EncodedOrigin;
var rotated = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
var width = rotated ? source.Height : source.Width;
var height = rotated ? source.Width : source.Height;

SKMatrix Orientation(int w, int h) => origin switch
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

SKImage Render(SKRectI area, int maxSize)
{
    var scale = Math.Min(1f, (float)maxSize / Math.Max(area.Width, area.Height));
    var info = new SKImageInfo(Math.Max(1, (int)Math.Round(area.Width * scale)), Math.Max(1, (int)Math.Round(area.Height * scale)));
    using var surface = SKSurface.Create(info);
    surface.Canvas.Scale(scale);
    surface.Canvas.Translate(-area.Left, -area.Top);
    surface.Canvas.Concat(Orientation(source.Width, source.Height));
    surface.Canvas.DrawImage(sourceImage, 0, 0, sampling);
    return surface.Snapshot();
}

SKImage Resize(SKImage image, int maxSize)
{
    var scale = Math.Min(1f, (float)maxSize / Math.Max(image.Width, image.Height));
    var info = new SKImageInfo(Math.Max(1, (int)Math.Round(image.Width * scale)), Math.Max(1, (int)Math.Round(image.Height * scale)));
    using var surface = SKSurface.Create(info);
    surface.Canvas.Scale(scale);
    surface.Canvas.DrawImage(image, 0, 0, sampling);
    return surface.Snapshot();
}

byte[] Webp(SKImage image) => image.Encode(SKEncodedImageFormat.Webp, 80).ToArray();

byte[] Hash(SKImage image)
{
    var scale = Math.Min(1f, 100f / Math.Max(image.Width, image.Height));
    var info = new SKImageInfo(Math.Max(1, (int)Math.Round(image.Width * scale)), Math.Max(1, (int)Math.Round(image.Height * scale)), SKColorType.Rgba8888, SKAlphaType.Unpremul);
    using var small = new SKBitmap(info);
    image.ScalePixels(small.PeekPixels(), sampling);
    return ThumbHash.FromImage(info.Width, info.Height, small.GetPixelSpan()).Hash.ToArray();
}

var side = Math.Min(width, height);
var square = SKRectI.Create((width - side) / 2, (height - side) / 2, side, side);

using var full = Render(square, 2048);
var fullBytes = Webp(full);
using var thumb = Resize(full, 400);
var thumbBytes = Webp(thumb);
var hash = Hash(full);
using var preview = Render(SKRectI.Create(width, height), 1200);

var (hw, hh, rgba) = new ThumbHash(hash).ToImage();
using var decoded = SKImage.FromPixelCopy(new SKImageInfo(hw, hh, SKColorType.Rgba8888, SKAlphaType.Unpremul), rgba);

File.WriteAllBytes(Path.Combine(outDir, "media-original.webp"), preview.Encode(SKEncodedImageFormat.Webp, 85).ToArray());
File.WriteAllBytes(Path.Combine(outDir, "media-full.webp"), fullBytes);
File.WriteAllBytes(Path.Combine(outDir, "media-thumb.webp"), thumbBytes);
File.WriteAllBytes(Path.Combine(outDir, "media-thumbhash.png"), decoded.Encode(SKEncodedImageFormat.Png, 100).ToArray());

var stats = new JsonObject
{
    ["original_bytes"] = bytes.Length,
    ["original_format"] = codec.EncodedFormat.ToString().ToLowerInvariant(),
    ["original_w"] = width,
    ["original_h"] = height,
    ["full_bytes"] = fullBytes.Length,
    ["full_px"] = full.Width,
    ["thumb_bytes"] = thumbBytes.Length,
    ["thumb_px"] = thumb.Width,
    ["thumbhash_bytes"] = hash.Length,
    ["thumbhash_base64"] = Convert.ToBase64String(hash),
};
var json = stats.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
File.WriteAllText(Path.Combine(outDir, "media.json"), json);
Console.WriteLine($"origin={origin}");
Console.WriteLine(json);
