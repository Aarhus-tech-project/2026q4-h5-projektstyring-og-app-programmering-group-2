# The SDK stage always runs on the build machine's own architecture and cross-compiles for the target,
# so arm64 images build without slow QEMU emulation
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore -a $TARGETARCH
COPY . .
RUN dotnet publish -c Release -a $TARGETARCH -o /app --no-restore

# EF migrations bundle, a single executable that applies pending migrations and exits.
# Build it with `--target migrations`; the default build skips this stage
FROM build AS migrations-build
ARG TARGETARCH
RUN dotnet tool install --global dotnet-ef --version 10.0.13
ENV PATH="$PATH:/root/.dotnet/tools"
RUN dotnet ef migrations bundle -r linux-$([ "$TARGETARCH" = "amd64" ] && echo x64 || echo $TARGETARCH) -o /efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS migrations
WORKDIR /app
COPY --from=migrations-build /efbundle .
# The bundle boots Program.Main to get the DbContext, so it needs the same base config as the server
COPY --from=build /src/appsettings.json .
ENTRYPOINT ["./efbundle"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Server.dll"]
