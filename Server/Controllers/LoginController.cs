using Microsoft.AspNetCore.Mvc;
using static Server.LoginController;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class LoginController(ILogger<LoginController> logger, LoginRepository _loginRepository, TokenGenerator tokenGenerator) : ControllerBase
{
    public record TokenResponse(string AccessToken, string RefreshToken);

    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] UserLoginDTO login)
    {
        logger.LogInformation("Hello World");

        User? user = await _loginRepository.Login(login);

        if (user == null)
        {
            return Unauthorized("Forkert email eller password");
        }
        else
        {
            return Ok(new TokenResponse (tokenGenerator.GenerateAccessToken(user), tokenGenerator.GenerateRefreshToken(user)));
        }
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserRegisterDTO login)
    {
        bool EmailSyntaxResult = _loginRepository.ValidEmailSyntax(login.Email);
            if (!EmailSyntaxResult) { return Conflict("Invalid email syntax"); }

        bool EmailTjekResult = await _loginRepository.MarkusesEmailTjek(login.Email);
            if (!EmailTjekResult) { return Conflict("Email findes allerede"); }

        await _loginRepository.Register(login);
        return Ok();
    }
}

public class TokenGenerator(IConfiguration config)
{
    public string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(JwtRegisteredClaimNames.Email, user.Email)
            ]),
            Issuer = config["Jwt:Issuer"],
            Audience = config["Jwt:Audience"],
            Expires = DateTime.UtcNow.AddMinutes(15),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    public string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); 
}