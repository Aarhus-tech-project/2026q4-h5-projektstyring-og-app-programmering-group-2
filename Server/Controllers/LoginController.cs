using Microsoft.AspNetCore.Mvc;
using static Server.LoginController;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class LoginController(ILogger<LoginController> logger, LoginRepository   _loginRepository, TokenGenerator tokenGenerator) : ControllerBase
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
            await _loginRepository.RevokeExistingSessions(user.Id, login.deviceName, login.platform);
            var refreshToken = tokenGenerator.GenerateRefreshToken();
            var session = await _loginRepository.InsertSession(user, refreshToken, login.deviceName, login.platform);
            if (session == null)
                return Unauthorized();
            var accessToken = tokenGenerator.GenerateAccessToken(user, session);

            return Ok(new TokenResponse(accessToken, refreshToken));
        }
    }

    [HttpPost("logout")]
    public async Task<IActionResult> logOut([FromHeader] string authorization)
    {
        var sessionId = await tokenGenerator.GetSessionId(authorization);
        if (sessionId is null) return Unauthorized();

        await _loginRepository.logOut(sessionId.Value);
        return Ok();
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

    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] string request)
    {
        var session = await _loginRepository.GetActiveSession(request);
        if (session == null) return Unauthorized();

        var refreshToken = tokenGenerator.GenerateRefreshToken();
        await _loginRepository.RotateSession(session, refreshToken);
        return Ok(new TokenResponse(tokenGenerator.GenerateAccessToken(session.User, session), refreshToken));
    }
}

public class TokenGenerator(IConfiguration config)
{
    public string GenerateAccessToken(User user, Session session)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Sid, session.Id.ToString())
            ]),
            Issuer = config["Jwt:Issuer"],
            Audience = config["Jwt:Audience"],
            Expires = DateTime.UtcNow.AddMinutes(15),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    public string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); 

    public async Task<Guid?> GetSessionId(string authorization)
    {
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(authorization.Replace("Bearer ", ""), new TokenValidationParameters
        {
            ValidIssuer = config["Jwt:Issuer"],
            ValidAudience = config["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!))
        });

        if (!result.IsValid) return null;
        return Guid.Parse((string)result.Claims[JwtRegisteredClaimNames.Sid]);
        }
    }