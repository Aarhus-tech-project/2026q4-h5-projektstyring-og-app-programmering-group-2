using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Server.Exceptions;
using Server.Models;
using Server.Repositories;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController(ILogger<AuthController> logger, AuthRepository authRepository, AuthService authService, TokenService tokenService) : ControllerBase
{
    public record TokenResponse(string AccessToken, string RefreshToken);

    [EnableRateLimiting("strict")]
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest request)
    {
        User user = await authRepository.Login(request) ?? throw new InvalidLoginException();

        await authService.RevokeDeviceSessions(user.Id, request.DeviceId);
        string refreshToken = tokenService.GenerateRefreshToken();
        Session session = await authService.InsertSession(user, refreshToken, request.DeviceId, request.DeviceName, request.Platform);

        logger.LogInformation("User {UserId} logged in on {Platform}, session {SessionId}", user.Id, request.Platform, session.Id);
        return new TokenResponse(tokenService.GenerateAccessToken(user, session), refreshToken);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        Guid userId = User.GetUserId();
        Guid sessionId = User.GetSessionId();

        await authService.RevokeSession(userId, sessionId);
        logger.LogInformation("User {UserId} logged out session {SessionId}", userId, sessionId);
        return Ok();
    }

    [Authorize]
    [HttpPost("logoutall")]
    public async Task<IActionResult> LogoutAll()
    {
        Guid userId = User.GetUserId();

        int revoked = await authService.RevokeAllSessions(userId);
        logger.LogInformation("User {UserId} logged out everywhere, revoked {Sessions} sessions", userId, revoked);
        return Ok();
    }

    [EnableRateLimiting("strict")]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        Guid userId = await authRepository.Register(request);
        logger.LogInformation("User {UserId} registered", userId);
        return Ok();
    }

    [EnableRateLimiting("strict")]
    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] string refreshToken)
    {
        Session session = await authService.GetActiveSession(refreshToken) ?? throw new InvalidRefreshTokenException();

        string newRefreshToken = tokenService.GenerateRefreshToken();
        if (!await authService.RotateSession(session, newRefreshToken)) throw new InvalidRefreshTokenException();
        return new TokenResponse(tokenService.GenerateAccessToken(session.User, session), newRefreshToken);
    }
}
