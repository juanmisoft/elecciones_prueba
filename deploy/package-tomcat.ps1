# Empaqueta el portal para Apache Tomcat (WAR estático) en Windows.
# Uso:
#   .\deploy\package-tomcat.ps1
#   .\deploy\package-tomcat.ps1 -WarName ROOT.war
#   .\deploy\package-tomcat.ps1 -WarName elecciones.war -Context elecciones

param(
    [string]$WarName = "elecciones.war",
    [string]$Context = $null
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Root) { $Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }
$Stage = Join-Path $Root "dist\tomcat-stage"
$OutDir = Join-Path $Root "dist"

if ($null -eq $Context) {
    if ($WarName -eq "ROOT.war") { $ContextName = "" }
    else { $ContextName = [System.IO.Path]::GetFileNameWithoutExtension($WarName) }
} else {
    $ContextName = $Context
}
$ContextPath = if ([string]::IsNullOrEmpty($ContextName)) { "" } else { "/$ContextName" }

Write-Host "==> Empaquetado Tomcat"
Write-Host "    origen : $Root"
Write-Host "    WAR    : $(Join-Path $OutDir $WarName)"
Write-Host "    context: $(if ($ContextPath) { $ContextPath } else { '/' })"

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "WEB-INF") | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Copy-Item (Join-Path $Root "deploy\tomcat\WEB-INF\web.xml") (Join-Path $Stage "WEB-INF\web.xml") -Force
Copy-Item (Join-Path $Root "index.html") (Join-Path $Stage "index.html") -Force
if (Test-Path (Join-Path $Root "favicon.ico")) {
    Copy-Item (Join-Path $Root "favicon.ico") (Join-Path $Stage "favicon.ico") -Force
}

function Copy-Tree($Src, $Dst) {
    if (Test-Path $Dst) { Remove-Item -Recurse -Force $Dst }
    New-Item -ItemType Directory -Force -Path $Dst | Out-Null
    robocopy $Src $Dst /E /NFL /NDL /NJH /NJS /nc /ns /np `
        /XF .DS_Store Thumbs.db *.map `
        | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy fallo ($LASTEXITCODE) $Src -> $Dst" }
}

Copy-Tree (Join-Path $Root "hub") (Join-Path $Stage "hub")
Copy-Tree (Join-Path $Root "generales") (Join-Path $Stage "generales")
Copy-Tree (Join-Path $Root "municipales") (Join-Path $Stage "municipales")

$ImgStage = Join-Path $Stage "Imagenes"
Copy-Tree (Join-Path $Root "Imagenes") $ImgStage
Get-ChildItem -Path $ImgStage -Recurse -File -Include "*.md","placeholder.txt" -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $Stage -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -like "SI_*.txt" -or
        $_.Name -match "CENSO.*DEFINITIVO" -or
        $_.Name -match "censo.*elector"
    } |
    ForEach-Object {
        Write-Host "    (RGPD) excluido: $($_.FullName.Substring($Stage.Length + 1))"
        Remove-Item $_.FullName -Force
    }

$Meta = Join-Path $Stage "META-INF"
New-Item -ItemType Directory -Force -Path $Meta | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
@"
Manifest-Version: 1.0
Created-By: package-tomcat.ps1
Implementation-Title: Elecciones Rivas Vaciamadrid
Implementation-Version: $stamp
"@ | Set-Content -Path (Join-Path $Meta "MANIFEST.MF") -Encoding ASCII

@"
<?xml version="1.0" encoding="UTF-8"?>
<Context path="$ContextPath" antiResourceLocking="false" />
"@ | Set-Content -Path (Join-Path $Meta "context.xml") -Encoding UTF8

$publicHint = if ($ContextPath) { "$ContextPath/" } else { "/" }
@"
Elecciones Rivas Vaciamadrid — paquete Tomcat
=============================================
Entrada: index.html → generales/index.html (login del portal).
El visor público permanece en el WAR pero no es la entrada por defecto.
Contenido: index.html, hub/, generales/, municipales/, Imagenes/, WEB-INF/

Despliegue:
1. Copiar $WarName a `$CATALINA_BASE/webapps/
2. Arrancar Tomcat 10+ (Jakarta) o adaptar web.xml a javax si usáis Tomcat 9
3. Abrir http://servidor:8080$publicHint
"@ | Set-Content -Path (Join-Path $Stage "DEPLOY.txt") -Encoding UTF8

$must = @(
    "index.html",
    "hub\index.html",
    "generales\index.html",
    "municipales\index.html",
    "Imagenes\Logo_OITR.png",
    "favicon.ico",
    "WEB-INF\web.xml"
)
foreach ($m in $must) {
    $p = Join-Path $Stage $m
    if (-not (Test-Path $p)) { throw "ERROR: falta $m en el stage" }
}

$warPath = Join-Path $OutDir $WarName
if (Test-Path $warPath) { Remove-Item $warPath -Force }

Push-Location $Stage
try {
    # Info-ZIP en Windows no admite -y; -qr basta para un WAR estático.
    & zip -qr $warPath .
    if ($LASTEXITCODE -ne 0) { throw "zip fallo con código $LASTEXITCODE" }
} finally {
    Pop-Location
}

$size = "{0:N1} MB" -f ((Get-Item $warPath).Length / 1MB)
Write-Host "==> OK $warPath ($size)"
Write-Host "    Stage: $Stage"
Write-Host "    Copiar a webapps/ y reiniciar Tomcat"
