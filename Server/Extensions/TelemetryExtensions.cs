using Npgsql;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Server;

public static class TelemetryExtensions
{
    public static IServiceCollection AddTelemetry(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddLogging(l => l.AddOpenTelemetry(o =>
        {
            o.IncludeFormattedMessage = true;
            o.IncludeScopes = true;
        }));

        services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService("fotolo"))
            .WithLogging(l => l.AddOtlpExporter(e =>
            {
                e.Endpoint = new Uri(configuration["Otlp:LogsEndpoint"]!);
                e.Protocol = OtlpExportProtocol.HttpProtobuf;
            }))
            .WithMetrics(m => m
                .AddAspNetCoreInstrumentation()
                .AddRuntimeInstrumentation()
                .AddHttpClientInstrumentation()
                .AddMeter("Npgsql")
                .AddOtlpExporter(e =>
                {
                    e.Endpoint = new Uri(configuration["Otlp:MetricsEndpoint"]!);
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
                    e.Endpoint = new Uri(configuration["Otlp:TracesEndpoint"]!);
                    e.Protocol = OtlpExportProtocol.HttpProtobuf;
                }));

        return services;
    }
}
