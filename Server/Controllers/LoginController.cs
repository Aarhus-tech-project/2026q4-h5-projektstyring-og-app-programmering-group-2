using Microsoft.AspNetCore.Mvc;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class LoginController(LoginRepository _loginRepository) : ControllerBase
{

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody]UserLoginDTO login)
    {
        var success = await _loginRepository.Login(login);
        return success ? Ok() : Unauthorized();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserLoginDTO login)
    {
        bool EmailTjekResult = await _loginRepository.MarkusesEmailTjek(login);
            if (!EmailTjekResult) { return Conflict("Email findes allerede"); }
    
        bool EmailSyntaxResult = _loginRepository.ValidEmailSyntax(login);
            if (!EmailSyntaxResult) { return Conflict("Invalid email syntax"); }

        await _loginRepository.Register(login);
        return Ok();
    }
}