$root = Split-Path $PSScriptRoot -Parent

dotnet build "$root/Server" -p:OpenApiGenerateDocumentsOnBuild=true
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run api:types --prefix "$root/App"
