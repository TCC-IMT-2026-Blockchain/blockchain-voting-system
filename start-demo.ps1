param(
  [switch]$NoReset,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$BlockchainDir = Join-Path $Root "blockchain"
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$VisualizerDir = Join-Path $Root "visualizer"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando obrigatorio nao encontrado no PATH: $Name"
  }
}

function Stop-Port {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    if ($processId -and $processId -ne 0) {
      Write-Host "Parando processo na porta $Port (PID $processId)"
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Clear-DirectoryContents {
  param([string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $rootPath = [System.IO.Path]::GetFullPath($Root)

  if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Recusando apagar fora do projeto: $fullPath"
  }

  if (Test-Path -LiteralPath $fullPath) {
    Get-ChildItem -LiteralPath $fullPath -Force | Remove-Item -Recurse -Force
  } else {
    New-Item -ItemType Directory -Path $fullPath | Out-Null
  }
}

function Ensure-Dependencies {
  param([string]$Path)

  if ($SkipInstall) {
    Write-Host "Pulando npm install em $Path"
    return
  }

  if (-not (Test-Path -LiteralPath (Join-Path $Path "node_modules"))) {
    Push-Location $Path
    try {
      if (Test-Path -LiteralPath "package-lock.json") {
        npm ci
      } else {
        npm install
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "Dependencias ja instaladas em $Path"
  }
}

function Start-NpmApp {
  param(
    [string]$Name,
    [string]$Path,
    [string[]]$Arguments
  )

  Write-Host "Iniciando $Name"
  Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList $Arguments `
    -WorkingDirectory $Path `
    -WindowStyle Hidden | Out-Null
}

Write-Host "Votify demo bootstrap" -ForegroundColor Yellow
Write-Host "Raiz: $Root"

Write-Step "Verificando ferramentas"
Assert-Command "docker"
Assert-Command "python"
Assert-Command "node"
Assert-Command "npm"

Write-Step "Parando servicos locais"
Stop-Port 3333
Stop-Port 5173
Stop-Port 5174

Write-Step "Parando containers MultiChain"
Push-Location $BlockchainDir
try {
  docker compose down --remove-orphans
} finally {
  Pop-Location
}

if (-not $NoReset) {
  Write-Step "Resetando dados da demo"
  Clear-DirectoryContents (Join-Path $BlockchainDir "master-data")
  Clear-DirectoryContents (Join-Path $BlockchainDir "slave-data")
  Clear-DirectoryContents (Join-Path $BlockchainDir "fiscal2-data")
  Clear-DirectoryContents (Join-Path $BackendDir "data")
} else {
  Write-Step "Mantendo dados existentes por causa de -NoReset"
}

Write-Step "Subindo e configurando a blockchain"
Push-Location $BlockchainDir
try {
  python .\scripts\votify.py up
  python .\scripts\votify.py authorize-slave
  python .\scripts\votify.py authorize-slave --slave "votify-fiscal-2"
  python .\scripts\votify.py setup
} finally {
  Pop-Location
}

Write-Step "Preparando backend"
Ensure-Dependencies $BackendDir
Push-Location $BackendDir
try {
  npm run build
} finally {
  Pop-Location
}

Write-Step "Preparando frontend"
Ensure-Dependencies $FrontendDir
Push-Location $FrontendDir
try {
  npm run build
} finally {
  Pop-Location
}

Write-Step "Preparando visualizador"
Ensure-Dependencies $VisualizerDir
Push-Location $VisualizerDir
try {
  npm run build
} finally {
  Pop-Location
}

Write-Step "Iniciando aplicacoes"
Start-NpmApp -Name "backend" -Path $BackendDir -Arguments @("run", "dev")
Start-NpmApp -Name "frontend" -Path $FrontendDir -Arguments @("run", "dev", "--", "--host", "0.0.0.0")
Start-NpmApp -Name "visualizador" -Path $VisualizerDir -Arguments @("run", "dev", "--", "--host", "0.0.0.0", "--port", "5174")

Start-Sleep -Seconds 5

Write-Step "Resumo"
Write-Host "Blockchain: containers votify-master, votify-slave e votify-fiscal-2"
Write-Host "Backend:    http://localhost:3333/api/v1"
Write-Host "Frontend:   http://localhost:5173"
Write-Host "Visual:     http://localhost:5174"
Write-Host "Config:     http://localhost:5173/configuracao"
Write-Host "Auditoria:  http://localhost:5173/auditoria"
Write-Host "Admin demo: http://localhost:5173/admin"
Write-Host ""
Write-Host "Depois de cadastrar eleitores e opcoes, use Config > Travar eleicao para revogar a governanca."
Write-Host ""
Write-Host "Pronto. Abra http://localhost:5173 e http://localhost:5174 no navegador." -ForegroundColor Green
