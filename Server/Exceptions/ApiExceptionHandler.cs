using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Server.Exceptions;

public class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not ApiException apiException) return false;

        var status = apiException.StatusCode;
        var method = context.Request.Method;
        var path = context.Request.Path.Value;
        var error = apiException.GetType().Name;

        if (status >= 500)
            logger.LogError(apiException, "{Method} {Path} failed with {StatusCode} {Error}", method, path, status, error);
        else if (status == 401)
            logger.LogWarning("{Method} {Path} rejected with {StatusCode} {Error}", method, path, status, error);
        else
            logger.LogInformation("{Method} {Path} rejected with {StatusCode} {Error}", method, path, status, error);

        context.Response.StatusCode = status;
        bool written = await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = apiException,
            ProblemDetails =
            {
                Status = status,
                Title = ReasonPhrases.GetReasonPhrase(status),
                Detail = apiException.Message,
            },
        });
        if (!written)
            await context.Response.WriteAsync(apiException.Message, cancellationToken);
        return true;
    }
}
