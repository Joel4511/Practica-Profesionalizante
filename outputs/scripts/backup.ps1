param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

if (-not $DatabaseUrl) {
  throw "Definí DATABASE_URL o pasala con -DatabaseUrl."
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $resolvedOutput "tgt_$timestamp.dump"

& pg_dump --format=custom --file=$backupFile $DatabaseUrl
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump no pudo crear la copia de seguridad."
}

Write-Output "Backup creado: $backupFile"
