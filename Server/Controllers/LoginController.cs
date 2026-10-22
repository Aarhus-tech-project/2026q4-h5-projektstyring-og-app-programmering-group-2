using Microsoft.AspNetCore.Mvc;

namespace Server;

[ApiController]
[Route("api/[controller]")]
public class LoginController : ControllerBase
{
    public LoginRepository _loginRepository;

    public LoginController(LoginRepository loginRepository) 
    {
        _loginRepository = loginRepository;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody]Login login)
    {
        var success = await _loginRepository.Login(login);
        return success ? Ok() : Unauthorized();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] Login login)
    {
        var success = await _loginRepository.Register(login);
        return success ? Ok() : Unauthorized();
    }
}