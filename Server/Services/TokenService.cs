using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Server.Models;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

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

    public async Task<UserAccessTokenDTO?> DecodeAccessToken(string authorization)
    {
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(authorization.Replace("Bearer ", ""), new TokenValidationParameters
        {
            ValidIssuer = config["Jwt:Issuer"],
            ValidAudience = config["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!))
        });

        if (!result.IsValid) return null;

        return new UserAccessTokenDTO
        {
            Id = Guid.Parse((string)result.Claims[JwtRegisteredClaimNames.Sub]),
            Username = (string)result.Claims[ClaimTypes.Name],
            Email = (string)result.Claims[JwtRegisteredClaimNames.Email]
        };
    }
}