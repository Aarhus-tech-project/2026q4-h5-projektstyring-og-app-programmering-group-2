Stop-Process -Name Server -ErrorAction SilentlyContinue
dotnet build ./Server -p:OpenApiGenerateDocumentsOnBuild=true
if ($LASTEXITCODE) { exit $LASTEXITCODE }
npm run api:types --prefix ./App
exit $LASTEXITCODE