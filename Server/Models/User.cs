using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using System.Security.Claims;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserRegisterDTO
{
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}

public class UserLoginDTO
{
    public string loginString { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string deviceName { get; set; } = null!;
    public string platform { get; set; } = null!;

}

public class UserLogoutDTO
{
    public string loginString { get; set; } = null!;
}

public class UserAccessTokenDTO
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
}