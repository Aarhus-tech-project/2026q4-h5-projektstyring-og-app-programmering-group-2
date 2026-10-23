#!/bin/sh
dotnet run --project ./Server --urls http://localhost:5198 &
SERVER_PID=$!
trap 'pkill -P $SERVER_PID; kill $SERVER_PID 2>/dev/null' EXIT

i=0
until nc -z localhost 5198; do
  i=$((i+1))
  [ $i -ge 60 ] && { echo "Server never came up"; exit 1; }
  sleep 1
done

npm run api:types --prefix ./App