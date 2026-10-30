using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Text;
using Server.Services;
using Server.Repositories;

namespace Server;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        AppContext.SetSwitch("Azure.Experimental.EnableActivitySource", true);
        builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true);

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new()
                {
                    ValidIssuer = builder.Configuration["Jwt:Issuer"],
                    ValidAudience = builder.Configuration["Jwt:Audience"],
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
                    NameClaimType = JwtRegisteredClaimNames.Name,
                };
            });

        builder.Services.AddAuthorization();

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(o =>
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
        builder.Services.AddProblemDetails();
        builder.Services.AddScoped<MediaService>();
        builder.Services.AddScoped<LoginRepository>();
        builder.Services.AddScoped<PostsRepository>();
        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")).UseSnakeCaseNamingConvention());
        builder.Services.AddSingleton(_ => new BlobServiceClient(builder.Configuration.GetConnectionString("Blobs")));
        builder.Services.AddOpenApi();
        builder.Services.AddScoped<TokenService>();
        builder.Services.AddScoped<AuthService>();
        builder.Services.AddTelemetry(builder.Configuration);

        var app = builder.Build();
        app.UseExceptionHandler();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
            app.MapOpenApi();
        }

        app.Run();
    }
}