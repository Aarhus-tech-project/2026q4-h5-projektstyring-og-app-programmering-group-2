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

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        builder.Services.AddProblemDetails();
        builder.Services.AddScoped<LoginRepository>();
        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql("Host=localhost;Username=postgres;Password=somethinglongandrandom;Database=postgres").UseSnakeCaseNamingConvention());
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
                e.Endpoint = new Uri("http://localhost:3100/otlp/v1/logs");
                e.Protocol = OtlpExportProtocol.HttpProtobuf;
            }))
            .WithMetrics(m => m
                .AddAspNetCoreInstrumentation()
                .AddRuntimeInstrumentation()
                .AddHttpClientInstrumentation()
                .AddOtlpExporter(e =>
                {
                    e.Endpoint = new Uri("http://localhost:9090/api/v1/otlp/v1/metrics");
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