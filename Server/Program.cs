using Azure.Storage.Blobs;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Server.Repositories;
using Server.Services;
using Server.Workers;
using System.Text;

namespace Server;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        AppContext.SetSwitch("Azure.Experimental.EnableActivitySource", true);
        builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true);

        var role = builder.Configuration["Role"] ?? "all";
        if (role is not ("api" or "voteworker" or "all"))
            throw new InvalidOperationException($"Unknown Role '{role}', expected api, voteworker or all");
        var isApi = role is "api" or "all";
        var isVoteWorker = role is "voteworker" or "all";

        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")).UseSnakeCaseNamingConvention());
        builder.Services.AddTelemetry(builder.Configuration, role);

        if (isApi)
        {
            builder.Services.AddJwtAuth(builder.Configuration);

            builder.Services.AddControllers();
            if (builder.Environment.IsDevelopment())
                builder.Services.AddSwaggerDocs();
            builder.Services.AddProblemDetails();
            builder.Services.AddScoped<MediaService>();
            builder.Services.AddScoped<LoginRepository>();
            builder.Services.AddScoped<PostsRepository>();
            builder.Services.AddScoped<TokenService>();
            builder.Services.AddScoped<AuthService>();
            builder.Services.AddExceptionHandler<ApiExceptionHandler>();
            builder.Services.AddSingleton(_ => new BlobServiceClient(builder.Configuration.GetConnectionString("Blobs")));
            builder.Services.AddControllers(o => o.Filters.Add<ValidationFilter>());
            builder.Services.AddValidatorsFromAssemblyContaining<Program>();
        }

        if (isVoteWorker)
            builder.Services.AddHostedService<VoteWorker>();

        var app = builder.Build();

        if (isApi)
        {   
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Users.FirstOrDefault(u => u.Email == "");
            }

            app.UseExceptionHandler();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();

            if (app.Environment.IsDevelopment())
                app.MapSwaggerDocs();
        }

        app.Run();
    }
}
