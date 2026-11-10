using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Identity.Client.Extensions.Msal;
using Server;
using System.Security.Claims;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string? Description { get; set; }
    public float Elo { get; set; } = 1000;
    public int Wins { get; set; }
    public int Losses { get; set; }
    public DateTime CreatedAt { get; set; }
    public byte[]? AvatarHash { get; set; }
    public Media? Avatar { get; set; }
}

public record RegisterRequest(string Username, string Email, string Password);

public record LoginRequest(string Email, string Password, Guid DeviceId, string DeviceName, string Platform);

public record Profile(Guid userId, string Username, string? Description, string? AvatarThumbnailUrl, string? AvatarUrl, string? AvatarThumbhash, float Elo, int Wins, int Losses)
{
    internal Profile(User u, BlobStorageService storage)
        : this(u.Id, u.Username, u.Description,
            u.AvatarHash is { } avatar ? storage.ThumbnailUrl(avatar) : null,
            u.AvatarHash is { } avatarImage ? storage.ImageUrl(avatarImage) : null,
            u.Avatar?.Thumbhash is { } thumbhash ? Convert.ToBase64String(thumbhash) : null,
            u.Elo, u.Wins, u.Losses)
    {
    }
}