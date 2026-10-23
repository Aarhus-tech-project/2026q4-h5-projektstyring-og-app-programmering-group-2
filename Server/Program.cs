using Microsoft.EntityFrameworkCore;

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