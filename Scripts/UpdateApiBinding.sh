#!/bin/sh
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"

dotnet build "$root/Server" -p:OpenApiGenerateDocumentsOnBuild=true
npm run api:types --prefix "$root/App"
