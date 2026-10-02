#!/bin/bash
# Votify demo bootstrap (Linux).
#
# Modo padrao (producao): reseta a blockchain, builda tudo com a API em /api/v1
# e reinicia o backend no PM2 (servido pelo nginx em https://votify-imt.tech).
#
# Opcoes:
#   --no-reset       mantem blockchain e backend/data existentes
#   --skip-install   nao roda npm ci/install
#   --dev            sobe backend/frontend/visualizador em modo dev (localhost)
#
# Variaveis: APP_USER (padrao: votify), PM2_APP (padrao: votify-api)
set -euo pipefail

NO_RESET=false
SKIP_INSTALL=false
DEV_MODE=false

for arg in "$@"; do
  case $arg in
    --no-reset) NO_RESET=true ;;
    --skip-install) SKIP_INSTALL=true ;;
    --dev) DEV_MODE=true ;;
    *) echo "Opcao desconhecida: $arg"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
BLOCKCHAIN_DIR="$ROOT/blockchain"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
VISUALIZER_DIR="$ROOT/visualizer"
LOG_DIR="$ROOT/logs"

APP_USER="${APP_USER:-votify}"
PM2_APP="${PM2_APP:-votify-api}"
PROD_API_BASE="/api/v1"
VISUALIZER_BASE="/visual/"

function write_step() {
  echo -e "\n\e[36m==> $1\e[0m"
}

function assert_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "Comando obrigatorio nao encontrado no PATH: $1"
    exit 1
  fi
}

# Executa como APP_USER quando o script roda como root, para que dist/, data/
# e node_modules nao fiquem com dono root (o backend no PM2 roda como APP_USER).
function run_as_app() {
  if [ "$(id -u)" -eq 0 ] && id "$APP_USER" &> /dev/null; then
    sudo -u "$APP_USER" -H bash -lc "$*"
  else
    bash -lc "$*"
  fi
}

function fix_ownership() {
  if [ "$(id -u)" -eq 0 ] && id "$APP_USER" &> /dev/null; then
    mkdir -p "$BACKEND_DIR/data"
    chown -R "$APP_USER:$APP_USER" "$BACKEND_DIR" "$FRONTEND_DIR" "$VISUALIZER_DIR"
    if [ -d "$LOG_DIR" ]; then chown -R "$APP_USER:$APP_USER" "$LOG_DIR"; fi
  fi
}

function stop_port() {
  local port=$1
  local pids
  pids=$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  if [ -n "$pids" ]; then
    echo "Parando processo na porta $port (PIDs: $(echo $pids | tr '\n' ' '))"
    kill $pids 2>/dev/null || true
  fi
}

function clear_directory() {
  local dir=$1
  if [ -d "$dir" ]; then
    find "$dir" -mindepth 1 -delete
  else
    mkdir -p "$dir"
  fi
}

function ensure_dependencies() {
  local path=$1
  if [ "$SKIP_INSTALL" = true ]; then
    echo "Pulando npm install em $path"
    return
  fi

  if [ ! -d "$path/node_modules" ]; then
    if [ -f "$path/package-lock.json" ]; then
      run_as_app "cd '$path' && npm ci"
    else
      run_as_app "cd '$path' && npm install"
    fi
  else
    echo "Dependencias ja instaladas em $path"
  fi
}

function start_dev_app() {
  local name=$1
  local path=$2
  shift 2
  echo "Iniciando $name (log em $LOG_DIR/$name.log)"
  run_as_app "cd '$path' && nohup npm $* > '$LOG_DIR/$name.log' 2>&1 &"
}

function wait_for_backend() {
  local url="http://127.0.0.1:3333/api/v1/health"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" > /dev/null 2>&1; then
      echo "Backend respondendo em $url"
      return
    fi
    sleep 1
  done
  echo "Backend nao respondeu em $url"
  exit 1
}

echo -e "\e[33mVotify demo bootstrap ($([ "$DEV_MODE" = true ] && echo dev || echo producao))\e[0m"
echo "Raiz: $ROOT"

write_step "Verificando ferramentas"
assert_command "docker"
assert_command "node"
assert_command "npm"
assert_command "curl"
if [ "$DEV_MODE" = false ] && ! run_as_app "command -v pm2" &> /dev/null; then
  echo "pm2 nao encontrado para o usuario $APP_USER"
  exit 1
fi

if command -v python &> /dev/null; then
  PYTHON_CMD="python"
else
  assert_command "python3"
  PYTHON_CMD="python3"
fi

write_step "Parando servicos"
if [ "$DEV_MODE" = true ]; then
  stop_port 3333
  stop_port 5173
  stop_port 5174
else
  run_as_app "pm2 stop '$PM2_APP'" || true
fi

write_step "Parando containers MultiChain"
(cd "$BLOCKCHAIN_DIR" && docker compose down --remove-orphans)

if [ "$NO_RESET" = false ]; then
  write_step "Resetando dados da demo"
  clear_directory "$BLOCKCHAIN_DIR/master-data"
  clear_directory "$BLOCKCHAIN_DIR/slave-data"
  clear_directory "$BLOCKCHAIN_DIR/fiscal2-data"
  clear_directory "$BACKEND_DIR/data"
else
  write_step "Mantendo dados existentes por causa de --no-reset"
fi

write_step "Subindo e configurando a blockchain"
(
  cd "$BLOCKCHAIN_DIR"
  $PYTHON_CMD scripts/votify.py up
  $PYTHON_CMD scripts/votify.py authorize-slave
  $PYTHON_CMD scripts/votify.py authorize-slave --slave "votify-fiscal-2"
  $PYTHON_CMD scripts/votify.py setup
)

fix_ownership

write_step "Preparando backend"
ensure_dependencies "$BACKEND_DIR"
run_as_app "cd '$BACKEND_DIR' && npm run build"

write_step "Preparando frontend"
ensure_dependencies "$FRONTEND_DIR"
if [ "$DEV_MODE" = true ]; then
  run_as_app "cd '$FRONTEND_DIR' && npm run build"
else
  run_as_app "cd '$FRONTEND_DIR' && VITE_API_BASE='$PROD_API_BASE' npm run build"
fi

write_step "Preparando visualizador"
ensure_dependencies "$VISUALIZER_DIR"
if [ "$DEV_MODE" = true ]; then
  run_as_app "cd '$VISUALIZER_DIR' && npm run build"
else
  run_as_app "cd '$VISUALIZER_DIR' && VITE_API_BASE='$PROD_API_BASE' npm run build -- --base '$VISUALIZER_BASE'"
fi

write_step "Iniciando aplicacoes"
if [ "$DEV_MODE" = true ]; then
  mkdir -p "$LOG_DIR"
  fix_ownership
  start_dev_app "backend" "$BACKEND_DIR" run dev
  start_dev_app "frontend" "$FRONTEND_DIR" run dev -- --host 0.0.0.0
  start_dev_app "visualizador" "$VISUALIZER_DIR" run dev -- --host 0.0.0.0 --port 5174
else
  # restart recarrega o backend/data/db.json recem-criado, alinhado com a chain nova
  if run_as_app "pm2 describe '$PM2_APP'" > /dev/null 2>&1; then
    run_as_app "pm2 restart '$PM2_APP'"
  else
    run_as_app "cd '$BACKEND_DIR' && pm2 start dist/server.js --name '$PM2_APP'"
  fi
  run_as_app "pm2 save"
fi

wait_for_backend

write_step "Resumo"
echo "Blockchain: containers votify-master, votify-slave e votify-fiscal-2"
if [ "$DEV_MODE" = true ]; then
  echo "Backend:    http://localhost:3333/api/v1"
  echo "Frontend:   http://localhost:5173"
  echo "Visual:     http://localhost:5174"
  echo "Logs:       $LOG_DIR"
else
  echo "Site:       https://votify-imt.tech"
  echo "Config:     https://votify-imt.tech/configuracao"
  echo "Auditoria:  https://votify-imt.tech/auditoria"
  echo "Visual:     https://votify-imt.tech/visual/"
  echo "Backend:    PM2 '$PM2_APP' (usuario $APP_USER)"
fi
echo ""
echo "Depois de cadastrar eleitores e opcoes, use Config > Travar eleicao para revogar a governanca."