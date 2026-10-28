using Microsoft.AspNetCore.Mvc;
using static Server.LoginController;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using Server.Models;
using Server.Repositories;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class LoginController(ILogger<LoginController> logger, LoginRepository _loginRepository, TokenGenerator tokenGenerator, AuthService authService) : ControllerBase
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
            await authService.RevokeExistingSessions(user.Id, login.deviceName, login.platform);
            var refreshToken = tokenGenerator.GenerateRefreshToken();
            var session = await authService.InsertSession(user, refreshToken, login.deviceName, login.platform);
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
        var session = await authService.GetActiveSession(request);
        if (session == null) return Unauthorized();

        var refreshToken = tokenGenerator.GenerateRefreshToken();
        await authService.RotateSession(session, refreshToken);
        return Ok(new TokenResponse(tokenGenerator.GenerateAccessToken(session.User, session), refreshToken));
    }
}
