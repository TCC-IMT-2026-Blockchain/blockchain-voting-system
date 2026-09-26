<#
.SYNOPSIS
    Script de configuração e inicialização do Print Agent do Votify.
#>

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

# 1. Verificar se está rodando como Administrador
Write-Host "Verificando privilégios de Administrador..."
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "A criação da Tarefa Agendada exige elevação. Por favor, execute este script como Administrador."
    exit 1
}

# 2. Verificar se Node.js está instalado
Write-Host "Verificando instalação do Node.js..."
try {
    $nodeVersion = node -v
    Write-Host "Node.js encontrado: $nodeVersion"
} catch {
    Write-Warning "Node.js não está instalado. Por favor, instale o Node.js."
    exit 1
}

# 3. Verificar o arquivo .env (não pede interativamente)
$envPath = Join-Path -Path $scriptDir -ChildPath ".env"
if (-not (Test-Path $envPath)) {
    Write-Warning "Arquivo .env não encontrado em $scriptDir. Crie-o antes de rodar o setup."
    exit 1
} else {
    Write-Host "Arquivo .env encontrado. Usando variáveis locais."
}

# 4. Rodar npm install se node_modules não existir
$nodeModulesPath = Join-Path -Path $scriptDir -ChildPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Pasta node_modules não encontrada. Executando npm install..."
    try {
        Push-Location $scriptDir
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install retornou código de erro $LASTEXITCODE"
        }
        Pop-Location
    } catch {
        Write-Warning "Falha ao executar npm install: $_"
        Pop-Location
        exit 1
    }
} else {
    Write-Host "Pasta node_modules já existe, pulando npm install."
}

# 5. Criar Tarefa Agendada
$taskName = "VotifyPrintAgent"
Write-Host "Configurando Tarefa Agendada '$taskName' para iniciar automaticamente no Logon..."

$skipTask = $false
try {
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        $overwrite = Read-Host "A tarefa '$taskName' já existe. Deseja recriá-la? (S/N)"
        if ($overwrite -match "^[Ss]") {
            if ($existingTask.State -eq 'Running') {
                Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
            }
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        } else {
            Write-Host "Mantendo a tarefa existente."
            $skipTask = $true
        }
    }

    if (-not $skipTask) {
        $logsDir = Join-Path -Path $scriptDir -ChildPath "logs"
        if (-not (Test-Path $logsDir)) {
            New-Item -ItemType Directory -Path $logsDir | Out-Null
        }
        
        $actionCmd = "powershell.exe"
        $actionArgs = "-WindowStyle Hidden -NonInteractive -Command `"`$logFile = Join-Path -Path 'logs' -ChildPath ('agent-' + (Get-Date -Format 'yyyyMMdd') + '.log'); npm run start:print *>> `$logFile`""

        $action = New-ScheduledTaskAction -Execute $actionCmd -Argument $actionArgs -WorkingDirectory $scriptDir
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Agente de Impressão do Votify" | Out-Null
        Write-Host "Tarefa Agendada criada com sucesso."
    }
} catch {
    Write-Warning "Falha ao configurar a Tarefa Agendada: $_"
    exit 1
}

# 6. Iniciar o servidor agora
Write-Host "`n=== Configuração Concluída ==="
Write-Host "Iniciando o servidor Print Agent agora (npm start)..."
Write-Host "Pressione Ctrl+C para parar."
Write-Host "----------------------------------------------------`n"

Push-Location $scriptDir
npm start
Pop-Location
