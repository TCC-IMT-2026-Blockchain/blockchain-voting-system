[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$Force,
  [switch]$RemoveImages
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlockchainDir = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$BlockchainRoot = [System.IO.Path]::GetFullPath($BlockchainDir).TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar

$targets = @(
  (Join-Path $BlockchainDir "master-data"),
  (Join-Path $BlockchainDir "slave-data"),
  (Join-Path $BlockchainDir "reports")
)

if (-not $Force -and -not $WhatIfPreference) {
  Write-Host ""
  Write-Host "ATENCAO: este script remove containers, rede Docker e dados locais da blockchain." -ForegroundColor Yellow
  Write-Host "Ele apaga master-data, slave-data e reports dentro de:" -ForegroundColor Yellow
  Write-Host "  $BlockchainDir" -ForegroundColor Yellow
  if ($RemoveImages) {
    Write-Host "Ele tambem remove a imagem Docker local criada pelo compose." -ForegroundColor Yellow
  }
  Write-Host ""

  $confirmation = Read-Host "Digite RESET para confirmar"
  if ($confirmation -ne "RESET") {
    Write-Host "Operacao cancelada."
    exit 0
  }
}

$composeArgs = @("compose", "down", "--volumes", "--remove-orphans")
if ($RemoveImages) {
  $composeArgs += @("--rmi", "local")
}

Push-Location $BlockchainDir
try {
  if ($PSCmdlet.ShouldProcess("Docker Compose em $BlockchainDir", "docker $($composeArgs -join ' ')")) {
    & docker @composeArgs
  }
}
finally {
  Pop-Location
}

foreach ($target in $targets) {
  $resolvedTarget = Resolve-Path $target -ErrorAction SilentlyContinue
  if (-not $resolvedTarget) {
    Write-Host "Nao existe, ignorando: $target"
    continue
  }

  $targetPath = [System.IO.Path]::GetFullPath($resolvedTarget.Path)
  if (-not $targetPath.StartsWith($BlockchainRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Caminho fora da pasta blockchain: $targetPath"
  }

  if ($PSCmdlet.ShouldProcess($targetPath, "Remove-Item -Recurse -Force")) {
    Remove-Item -LiteralPath $targetPath -Recurse -Force
    Write-Host "Removido: $targetPath"
  }
}

Write-Host ""
if ($WhatIfPreference) {
  Write-Host "Simulacao concluida. Nenhum container ou arquivo foi removido." -ForegroundColor Green
}
else {
  Write-Host "Reset concluido. Para iniciar do zero, execute:" -ForegroundColor Green
  Write-Host "  .\scripts\setup-chain.ps1" -ForegroundColor Green
}
