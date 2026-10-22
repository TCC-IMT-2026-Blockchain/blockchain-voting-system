<#
.SYNOPSIS
    Script de inicialização para impressão sequencial de números (000 a 999) com a logo do Votify.
.PARAMETER Reset
    Opcional. Se informado, apaga o histórico (sequence-state.json) e reinicia a contagem a partir do 000.
.PARAMETER DryRun
    Opcional. Se informado, simula a geração dos PDFs e o intervalo de 7s sem enviar para a impressora física.
#>
param(
    [switch]$Reset,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

Write-Host "=== Votify - Impressão Sequencial de Números (000 a 999) ===" -ForegroundColor Cyan

# 1. Verificar se Node.js está instalado
Write-Host "Verificando instalação do Node.js..."
try {
    $nodeVersion = node -v
    Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Warning "Node.js não está instalado. Por favor, instale o Node.js antes de continuar."
    exit 1
}

# 2. Verificar o arquivo .env (cria a partir do .env.example se não existir)
$envPath = Join-Path -Path $scriptDir -ChildPath ".env"
$envExamplePath = Join-Path -Path $scriptDir -ChildPath ".env.example"
if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item -Path $envExamplePath -Destination $envPath
        Write-Host "Arquivo .env criado automaticamente a partir de .env.example." -ForegroundColor Yellow
    } else {
        Write-Warning "Arquivo .env não encontrado em $scriptDir."
        exit 1
    }
} else {
    Write-Host "Arquivo .env encontrado." -ForegroundColor Green
}

# 3. Rodar npm install se node_modules não existir
$nodeModulesPath = Join-Path -Path $scriptDir -ChildPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Pasta node_modules não encontrada. Executando npm install..." -ForegroundColor Yellow
    Push-Location $scriptDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install retornou código de erro $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Dependências (node_modules) prontas." -ForegroundColor Green
}

# 4. Exibir status do checkpoint antes de iniciar
$stateFile = Join-Path -Path $scriptDir -ChildPath "sequence-state.json"
if ($Reset -and (Test-Path $stateFile)) {
    Write-Host "Parâmetro -Reset detectado: o estado anterior será reiniciado para 000." -ForegroundColor Yellow
} elseif (Test-Path $stateFile) {
    try {
        $state = Get-Content $stateFile -Raw | ConvertFrom-Json
        Write-Host "Último número registrado: $($state.lastPrinted) (atualizado em $($state.updatedAt))" -ForegroundColor Cyan
    } catch {
        Write-Host "Arquivo de estado encontrado." -ForegroundColor Cyan
    }
} else {
    Write-Host "Nenhum estado anterior registrado. A impressão começará em 000." -ForegroundColor Cyan
}

# 5. Iniciar a impressão sequencial
Write-Host "`nIniciando impressão sequencial..." -ForegroundColor Green
Write-Host "Pressione Ctrl+C a qualquer momento para pausar (o progresso salvo será mantido)." -ForegroundColor Yellow
Write-Host "------------------------------------------------------------`n"

$cliArgs = @("index.ts")
if ($Reset) { $cliArgs += "--reset" }
if ($DryRun) { $cliArgs += "--dry-run" }

Push-Location $scriptDir
try {
    npx tsx @cliArgs
} finally {
    Pop-Location
}
