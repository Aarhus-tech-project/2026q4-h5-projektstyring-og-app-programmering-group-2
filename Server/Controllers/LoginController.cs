using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Server.Models;
using Server.Services;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Server.Repositories;
using Server.Exceptions;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoginController(ILogger<LoginController> logger, LoginRepository _loginRepository, TokenService tokenGenerator, AuthService authService) : ControllerBase
{
    public record TokenResponse(string AccessToken, string RefreshToken);

    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] UserLoginDTO login)
    {
        logger.LogInformation("Hello World");

        User? user = await _loginRepository.Login(login);

        if (user == null)
        {
            throw new InvalidLoginException();
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
    [Authorize]
    public async Task<IActionResult> logOut([FromHeader] string refreshToken)
    {
        var sessionId = await tokenGenerator.GetSessionId(refreshToken);
        if (sessionId is null) return Unauthorized();

        await _loginRepository.logOut(sessionId.Value);
        return Ok();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserRegisterDTO login)
    {
        bool EmailSyntaxResult = _loginRepository.ValidEmailSyntax(login.Email);
            if (!EmailSyntaxResult) { throw new InvalidEmailSyntaxException(); }

        bool EmailTjekResult = await _loginRepository.MarkusesEmailTjek(login.Email);
            if (!EmailTjekResult) { throw new EmailFindesAlleredeException(); }

        await _loginRepository.Register(login);
        return Ok();
    }

    [HttpPost("refresh")]
    [Authorize]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] string refreshToken)
    {
        var session = await authService.GetActiveSession(refreshToken);
            if (session == null) return Unauthorized();

        var newRefreshToken = tokenGenerator.GenerateRefreshToken();
        await authService.RotateSession((Session)session, refreshToken);
        return Ok(new TokenResponse(tokenGenerator.GenerateAccessToken(session.User, session), refreshToken));
    }
}
