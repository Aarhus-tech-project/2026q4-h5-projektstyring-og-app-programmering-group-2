using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Server;

public static class RateLimitingExtensions
{
    public static IServiceCollection AddRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = (context, _) =>
            {
                var http = context.HttpContext;
                var policy = http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName ?? "global";
                http.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("Server.RateLimiting")
                    .LogWarning("Rate limit {Policy} hit on {Method} {Path} by {UserId} from {Ip}",
                        policy, http.Request.Method, http.Request.Path.Value,
                        http.User.FindFirstValue(JwtRegisteredClaimNames.Sub), http.Connection.RemoteIpAddress?.ToString());
                return ValueTask.CompletedTask;
            };
            o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1) }));
            o.AddPolicy("strict", ctx =>
            RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
        });
}