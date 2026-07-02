# SERVIDOR LOCAL NATIVO EN POWERSHELL PARA EVITAR ERRORES DE CORS
# Hace doble clic sobre este script o ejecútalo en consola para iniciar el portal.

$port = 8080
$listener = New-Object System.Net.HttpListener
$started = $false

# Intenta buscar un puerto libre automáticamente entre 8080 y 8100 para evitar fallos si el 8080 está ocupado
while (-not $started -and $port -lt 8100) {
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        $started = $true
    } catch {
        Write-Host "Puerto $port ocupado. Probando con el puerto $($port + 1)..." -ForegroundColor Yellow
        $port++
    }
}

if (-not $started) {
    Write-Host "Error: No se pudo iniciar el servidor en ningún puerto entre 8080 y 8100." -ForegroundColor Red
    exit
}

try {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Servidor local corriendo en http://localhost:$port/" -ForegroundColor Green
    Write-Host "  Presiona CTRL+C en esta consola para detener el servidor" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
    
    # Abre automáticamente el navegador predeterminado en el puerto asignado
    Start-Process "http://localhost:$port/index.html"
    
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            $url = $request.Url.LocalPath
            # Decodifica caracteres especiales simples como espacios (%20)
            $url = $url.Replace("%20", " ")
            if ($url -eq "/") { $url = "/index.html" }
            
            # Quitar la barra inclinada inicial para evitar que Join-Path lo interprete como raíz de volumen
            $relativePath = $url.TrimStart('/')
            $filePath = Join-Path (Get-Location) $relativePath
            
            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                
                # Detecta el tipo de contenido (MIME type)
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "text/plain"
                if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
                elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
                elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
                elseif ($ext -eq ".png") { $contentType = "image/png" }
                elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
                elseif ($ext -eq ".gif") { $contentType = "image/gif" }
                elseif ($ext -eq ".svg") { $contentType = "image/svg+xml; charset=utf-8" }
                
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
            }
            $response.Close()
        } catch {
            # Captura y maneja silenciosamente errores de sockets o tuberías rotas para que el servidor no se caiga
            if ($null -ne $response) {
                try { $response.Close() } catch {}
            }
        }
    }
} finally {
    $listener.Stop()
}
