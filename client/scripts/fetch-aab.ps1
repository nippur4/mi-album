# Descarga el .aab de un build de EAS a client/builds/ para tenerlo local.
# EAS buildea en la nube (en Windows no hay build --local sin WSL), así que el
# artefacto no queda en disco solo: este script lo trae.
#
# Uso (desde client/):
#   npm run aab            -> el ultimo build de Android "finished"
#   npm run aab -- <id>    -> un build puntual por ID
param([string]$BuildId)

$ErrorActionPreference = "Stop"
# Correr siempre desde client/ (la carpeta padre de scripts/).
Set-Location (Join-Path $PSScriptRoot "..")

if ($BuildId) {
  $b = eas build:view $BuildId --json | ConvertFrom-Json
} else {
  $list = eas build:list --platform android --status finished --limit 1 --json --non-interactive | ConvertFrom-Json
  if (-not $list) { throw "No hay builds de Android 'finished' en EAS." }
  $b = $list[0]
}

$url = $b.artifacts.applicationArchiveUrl
if (-not $url) { throw "El build $($b.id) no tiene .aab (applicationArchiveUrl vacio)." }

New-Item -ItemType Directory -Force -Path builds | Out-Null
$short = $b.id.Substring(0, 8)
$out = "builds/mi-album-$($b.appVersion)-$short.aab"

Write-Host "Descargando AAB  version $($b.appVersion)  build $short ..."
Invoke-WebRequest -Uri $url -OutFile $out
Write-Host "Listo: $((Resolve-Path $out).Path)"
