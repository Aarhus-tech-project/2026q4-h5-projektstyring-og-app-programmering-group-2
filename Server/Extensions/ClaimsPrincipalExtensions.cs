using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Server;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? throw new UnauthorizedAccessException());

    public static Guid GetSessionId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(JwtRegisteredClaimNames.Sid) ?? throw new UnauthorizedAccessException());
}