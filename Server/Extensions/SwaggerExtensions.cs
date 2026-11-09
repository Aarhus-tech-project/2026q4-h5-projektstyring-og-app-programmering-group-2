using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;

namespace Server;

public static class SwaggerExtensions
{
    public static IServiceCollection AddSwaggerDocs(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddOpenApi(o => o.AddOperationTransformer(async (operation, context, ct) =>
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
        }));
        services.AddSwaggerGen(o =>
        {
            // Adds the Authorize button to Swagger UI; paste the access token from /api/login/login (no "Bearer " prefix)
            o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
            });
            o.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", doc)] = [],
            });
        });

        return services;
    }

    public static WebApplication MapSwaggerDocs(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI();
        app.MapOpenApi();

        return app;
    }
}
