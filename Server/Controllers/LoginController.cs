using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Server.Exceptions;
using Server.Models;
using Server.Repositories;
using Server.Services;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Validator;


namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoginController(LoginRepository loginRepository, TokenService tokenGenerator, AuthService authService) : ControllerBase
{
    public record TokenResponse(string AccessToken, string RefreshToken);

    [EnableRateLimiting("strict")]
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] UserLoginDTO login)
    {
        User? user = await loginRepository.Login(login);

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

        await loginRepository.logOut(sessionId.Value);
        return Ok();
    }

    [HttpPost("logoutall")]
    [Authorize]
    public async Task<IActionResult> logoutall([FromHeader] string refreshToken)
    {
        User user = await loginRepository.GetUserViaUserID(refreshToken);

        await loginRepository.RevokeAllUserSessions(user);

        return Ok();
    }

    [EnableRateLimiting("strict")]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserRegisterDTO login)
    {
        await loginRepository.Register(login);
        return Ok();
    }

    [EnableRateLimiting("strict")]
    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] string refreshToken)
    {
        var session = await authService.GetActiveSession(refreshToken);
            if (session == null) return Unauthorized();

        var newRefreshToken = tokenGenerator.GenerateRefreshToken();
        await authService.RotateSession((Session)session, newRefreshToken);
        return Ok(new TokenResponse(tokenGenerator.GenerateAccessToken(session.User, session), newRefreshToken));
    }
}
