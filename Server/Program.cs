using Azure.Storage.Blobs;
using Microsoft.EntityFrameworkCore;
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

        builder.Services.AddJwtAuth(builder.Configuration);

        builder.Services.AddControllers();
        if (builder.Environment.IsDevelopment())
            builder.Services.AddSwaggerDocs();
        builder.Services.AddProblemDetails();
        builder.Services.AddScoped<MediaService>();
        builder.Services.AddScoped<LoginRepository>();
        builder.Services.AddScoped<PostsRepository>();
        builder.Services.AddExceptionHandler<ApiExceptionHandler>();    
        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")).UseSnakeCaseNamingConvention());
        builder.Services.AddSingleton(_ => new BlobServiceClient(builder.Configuration.GetConnectionString("Blobs")));
        builder.Services.AddScoped<TokenService>();
        builder.Services.AddScoped<AuthService>();
        builder.Services.AddTelemetry(builder.Configuration);

        var app = builder.Build();
        app.UseExceptionHandler();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        if (app.Environment.IsDevelopment())
            app.MapSwaggerDocs();

        app.Run();
    }
}