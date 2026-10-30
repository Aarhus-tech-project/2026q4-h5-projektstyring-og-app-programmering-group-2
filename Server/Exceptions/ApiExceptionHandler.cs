using Microsoft.AspNetCore.Diagnostics;
using Server.Exceptions;

public class ApiExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not ApiException apiException) return false;

        context.Response.StatusCode = apiException.StatusCode;
        await context.Response.WriteAsync(apiException.Message, cancellationToken);
        return true;
    }
}