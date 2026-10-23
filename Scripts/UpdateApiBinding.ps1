$server = Start-Process dotnet -ArgumentList 'run','--project','./Server','--urls','http://localhost:5198' -NoNewWindow -PassThru

try {
    $up = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $tcp = [System.Net.Sockets.TcpClient]::new('localhost', 5198)
            $tcp.Dispose()
            $up = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $up) { Write-Error "Server never came up"; exit 1 }

    npm run api:types --prefix ./App
}
finally {
    if (-not $server.HasExited) { $server.Kill($true) }
}