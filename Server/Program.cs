using Azure.Storage.Blobs;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;

namespace Server;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true);

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        builder.Services.AddProblemDetails();
        builder.Services.AddScoped<LoginRepository>();
        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")).UseSnakeCaseNamingConvention());
        builder.Services.AddSingleton(_ => new BlobServiceClient(builder.Configuration.GetConnectionString("Blobs")));
        builder.Services.AddOpenApi();
        
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
                .AddOtlpExporter(e =>
                {
                    e.Endpoint = new Uri(builder.Configuration["Otlp:MetricsEndpoint"]!);
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