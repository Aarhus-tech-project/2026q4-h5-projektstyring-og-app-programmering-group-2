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

        var success = await _loginRepository.Login(login);
        return success ? Ok(new TokenResponse (tokenGenerator.GenerateAccessToken(login), tokenGenerator.GenerateRefreshToken(login))) : Unauthorized("Forkert email eller password");
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserRegisterDTO login)
    {
        bool EmailTjekResult = await _loginRepository.MarkusesEmailTjek(login.Email);
            if (!EmailTjekResult) { return Conflict("Email findes allerede"); }
    
        bool EmailSyntaxResult = _loginRepository.ValidEmailSyntax(login.Email);
            if (!EmailSyntaxResult) { return Conflict("Invalid email syntax"); }

        await _loginRepository.Register(login);
        return Ok();
    }
}

public class TokenGenerator 
{
    public string GenerateAccessToken(UserLoginDTO login)
    {

    }

    public string GenerateRefreshToken(UserLoginDTO login)
    {

    }
}