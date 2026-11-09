using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;

namespace Server;

public static class SwaggerExtensions
{
    public static IServiceCollection AddSwaggerDocs(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddOpenApi(o =>
        {
            o.AddDocumentTransformer((document, _, _) =>
            {
                document.AddComponent<IOpenApiSecurityScheme>("Bearer", new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                });
                document.Security = [new OpenApiSecurityRequirement
                {
                    [new OpenApiSecuritySchemeReference("Bearer", document)] = [],
                }];
                return Task.CompletedTask;
            });
            o.AddOperationTransformer(async (operation, context, ct) =>
            {
                var document = context.Document!;
                if (document.Components?.Schemas?.ContainsKey(nameof(ProblemDetails)) != true)
                    document.AddComponent(nameof(ProblemDetails), await context.GetOrCreateSchemaAsync(typeof(ProblemDetails), null, ct));

                operation.Responses ??= [];
                operation.Responses["default"] = new OpenApiResponse
                {
                    Description = "Error",
                    Content = new Dictionary<string, OpenApiMediaType>
                    {
                        ["application/problem+json"] = new() { Schema = new OpenApiSchemaReference(nameof(ProblemDetails), document) },
                    },
                };
            });
        });

        return services;
    }

    public static WebApplication MapSwaggerDocs(this WebApplication app)
    {
        app.MapOpenApi();
        app.UseSwaggerUI(o => o.SwaggerEndpoint("/openapi/v1.json", "v1"));

        return app;
    }
}
