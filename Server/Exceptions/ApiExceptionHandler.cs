using Microsoft.AspNetCore.Diagnostics;
using Server.Exceptions;

public class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not ApiException apiException) return false;

        var status = apiException.StatusCode;
        var method = context.Request.Method;
        var path = context.Request.Path.Value; // no query string, so nothing sensitive ends up in logs
        var error = apiException.GetType().Name;

        if (status >= 500)
            logger.LogError(apiException, "{Method} {Path} failed with {StatusCode} {Error}", method, path, status, error);
        else if (status == 401)
            logger.LogWarning("{Method} {Path} rejected with {StatusCode} {Error}", method, path, status, error);
        else
            logger.LogInformation("{Method} {Path} rejected with {StatusCode} {Error}", method, path, status, error);

        context.Response.StatusCode = status;
        await context.Response.WriteAsync(apiException.Message, cancellationToken);
        return true;
    }
}
