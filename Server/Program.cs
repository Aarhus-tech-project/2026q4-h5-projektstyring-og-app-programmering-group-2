using Azure.Storage.Blobs;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Server.Repositories;

namespace Server;

public class Program
{
    public static void Main(string[] args)
    {
        AppContext.SetSwitch("Azure.Experimental.EnableActivitySource", true);

        var builder = WebApplication.CreateBuilder(args);
        builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true);

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        builder.Services.AddProblemDetails();
        builder.Services.AddScoped<MediaService>();
        builder.Services.AddScoped<LoginRepository>();
        builder.Services.AddScoped<PostsRepository>();
        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")).UseSnakeCaseNamingConvention());
        builder.Services.AddSingleton(_ => new BlobServiceClient(builder.Configuration.GetConnectionString("Blobs")));
        builder.Services.AddOpenApi();
        builder.Services.AddScoped<TokenGenerator>();
        builder.Services.AddScoped<AuthService>();

        builder.Logging.AddOpenTelemetry(o =>
        {
            o.IncludeFormattedMessage = true;
            o.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService("fotolo"))
            .WithLogging(l => l.AddOtlpExporter(e =>
            {
                e.Endpoint = new Uri(builder.Configuration["Otlp:LogsEndpoint"]!);
                e.Protocol = OtlpExportProtocol.HttpProtobuf;
            }))
            .WithMetrics(m => m
                .AddAspNetCoreInstrumentation()
                .AddRuntimeInstrumentation()
                .AddHttpClientInstrumentation()
                .AddMeter("Npgsql")
                .AddOtlpExporter(e =>
                {
                    e.Endpoint = new Uri(builder.Configuration["Otlp:MetricsEndpoint"]!);
                    e.Protocol = OtlpExportProtocol.HttpProtobuf;
                }))
            .WithTracing(t => t
                .AddAspNetCoreInstrumentation(o => o.RecordException = true)
                .AddHttpClientInstrumentation(o => o.RecordException = true)
                .AddNpgsql()
                .AddSource("Azure.*")
                .AddSource("Server")
                .AddOtlpExporter(e =>
                {
                    e.Endpoint = new Uri(builder.Configuration["Otlp:TracesEndpoint"]!);
                    e.Protocol = OtlpExportProtocol.HttpProtobuf;
                }));
            
        var app = builder.Build();
        app.MapControllers();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
            app.MapOpenApi();
        }

        app.UseExceptionHandler();
        app.Run();
    }
}