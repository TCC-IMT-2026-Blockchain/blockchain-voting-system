import "./styles.css";
import logoVotifyUrl from "../../frontend/src/assets/logo-votify.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3333/api/v1";

type VisualSystem = "votify" | "votifalho";

type VisualEventType =
  | "voter_registration"
  | "ballot_saved"
  | "election_locked"
  | "election_lock_rejected"
  | "vote_cast"
  | "vote_rejected"
  | "receipt_verified"
  | "audit_recalculated"
  | "vote_change_attempt";

type VisualEvent = {
  id: string;
  type: VisualEventType;
  system: VisualSystem;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type FlowStep = {
  label: string;
  detail: string;
  icon: IconName;
};

type FlowDefinition = {
  title: string;
  steps: FlowStep[];
  failureStepIndex?: number;
};

type ConnectionState = "connecting" | "online" | "offline";

type IconName =
  | "app"
  | "api"
  | "hash"
  | "stream"
  | "chain"
  | "nodes"
  | "ballot"
  | "token"
  | "burn"
  | "block"
  | "lock"
  | "receipt"
  | "audit"
  | "database"
  | "warning";

const iconPaths: Record<IconName, string> = {
  app: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  api: '<path d="M7 8h10M7 16h10"/><path d="M10 5 6 12l4 7M14 5l4 7-4 7"/>',
  hash: '<path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"/>',
  stream: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  chain: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
  nodes: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.6 10.5 6.8-3M8.6 13.5l6.8 3"/>',
  ballot: '<path d="M9 11h6M9 15h4"/><path d="M7 3h10l3 3v15H7z"/><path d="M17 3v4h4"/>',
  token: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 10.2c0-1.2 1.2-2 3-2s3 .8 3 2-1.2 1.8-3 1.8-3 .7-3 1.9 1.2 2 3 2 3-.8 3-2"/>',
  burn: '<path d="M12 22c4 0 7-2.6 7-6.5 0-3.3-2-5.3-4.3-7.6-.7 2-2.1 3.4-3.7 4.1.2-3-1.1-5.8-3.3-8C7.6 7.7 5 10.6 5 15.5 5 19.4 8 22 12 22z"/>',
  block: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  receipt: '<path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z"/><path d="M10 8h4M10 12h4M10 16h2"/>',
  audit: '<path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-9"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  warning: '<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17h.01"/>'
};

const idleFlow: FlowDefinition = {
  title: "Aguardando ação",
  steps: [
    { label: "Interface", detail: "Ação do usuário", icon: "app" },
    { label: "API", detail: "Chamada recebida", icon: "api" },
    { label: "Blockchain", detail: "Registro ou consulta", icon: "chain" },
    { label: "Nós", detail: "Replicação", icon: "nodes" }
  ]
};

const flows: Record<VisualEventType, FlowDefinition> = {
  voter_registration: {
    title: "Cadastro protegido do eleitor",
    steps: [
      { label: "Interface", detail: "Cadastro solicitado", icon: "app" },
      { label: "API", detail: "Recebe o pedido", icon: "api" },
      { label: "HMAC-SHA256", detail: "Gera hash do eleitor", icon: "hash" },
      { label: "Identidades", detail: "Stream recebe o registro", icon: "stream" },
      { label: "Blockchain", detail: "Transação publicada", icon: "chain" },
      { label: "Nós", detail: "Estado replicado", icon: "nodes" }
    ]
  },
  ballot_saved: {
    title: "Configuração da eleição",
    steps: [
      { label: "Interface", detail: "Opções definidas", icon: "ballot" },
      { label: "API", detail: "Valida formato", icon: "api" },
      { label: "Configuração", detail: "Eleição atualizada", icon: "database" }
    ]
  },
  election_locked: {
    title: "Travamento da governança",
    steps: [
      { label: "Configuração", detail: "Eleitores e opções definidos", icon: "ballot" },
      { label: "Credenciais", detail: "Tokens emitidos", icon: "token" },
      { label: "Nó Master", detail: "Recebe comando de trava", icon: "nodes" },
      { label: "Privilégios", detail: "Admin, criação e emissão revogados", icon: "lock" },
      { label: "Nó Fiscal", detail: "Master passa a auditar", icon: "audit" },
      { label: "Rede", detail: "Configuração congelada", icon: "chain" }
    ]
  },
  election_lock_rejected: {
    title: "Trava não aplicada",
    failureStepIndex: 2,
    steps: [
      { label: "Configuração", detail: "Pedido recebido", icon: "ballot" },
      { label: "API", detail: "Valida requisitos", icon: "api" },
      { label: "Pendência", detail: "Faltam dados", icon: "warning" },
      { label: "Blockchain", detail: "Nada foi alterado", icon: "chain" }
    ]
  },
  vote_cast: {
    title: "Transação de voto",
    steps: [
      { label: "Chave privada", detail: "Prova simulada", icon: "lock" },
      { label: "API", detail: "Localiza credencial", icon: "api" },
      { label: "Transação", detail: "Voto preparado", icon: "ballot" },
      { label: "Urna", detail: "Escolha publicada", icon: "stream" },
      { label: "Queima", detail: "Token consumido", icon: "burn" },
      { label: "Bloco", detail: "Registro imutável", icon: "block" },
      { label: "Nós", detail: "Replicação da rede", icon: "nodes" }
    ]
  },
  vote_rejected: {
    title: "Voto bloqueado",
    failureStepIndex: 3,
    steps: [
      { label: "Chave privada", detail: "Prova enviada", icon: "lock" },
      { label: "API", detail: "Localiza eleitor", icon: "api" },
      { label: "Credencial", detail: "Token verificado", icon: "token" },
      { label: "Blockchain", detail: "Regra rejeita transação", icon: "warning" },
      { label: "Urna", detail: "Nenhum voto é gravado", icon: "stream" }
    ]
  },
  receipt_verified: {
    title: "Verificação do comprovante",
    steps: [
      { label: "TXID", detail: "Comprovante informado", icon: "receipt" },
      { label: "Urna", detail: "Busca na stream", icon: "stream" },
      { label: "Bloco", detail: "Localiza inclusão", icon: "block" },
      { label: "Confirmações", detail: "Idade do registro", icon: "chain" },
      { label: "Hash", detail: "Conferência local", icon: "hash" }
    ]
  },
  audit_recalculated: {
    title: "Auditoria geral",
    steps: [
      { label: "Urna", detail: "Votos publicados", icon: "stream" },
      { label: "Tokens", detail: "Queimas contabilizadas", icon: "burn" },
      { label: "Blocos", detail: "Confirmações lidas", icon: "chain" },
      { label: "Auditoria", detail: "Script recalcula", icon: "audit" },
      { label: "Resultado", detail: "Contagem conferida", icon: "ballot" }
    ]
  },
  vote_change_attempt: {
    title: "Tentativa de alteração",
    steps: [
      { label: "Comando", detail: "Alterar voto", icon: "warning" },
      { label: "API", detail: "Executa tentativa", icon: "api" },
      { label: "Registro", detail: "Estado conferido", icon: "database" },
      { label: "Resultado", detail: "Aceito ou bloqueado", icon: "audit" }
    ]
  }
};

const blockedAttackFlow: FlowDefinition = {
  title: "Ataque bloqueado",
  failureStepIndex: 3,
  steps: [
    { label: "Comando", detail: "Alterar voto registrado", icon: "warning" },
    { label: "API", detail: "Tenta executar", icon: "api" },
    { label: "Blockchain", detail: "Confere estado real", icon: "chain" },
    { label: "Token", detail: "Credencial já consumida", icon: "burn" },
    { label: "Resultado", detail: "Voto original preservado", icon: "lock" }
  ]
};

const acceptedAttackFlow: FlowDefinition = {
  title: "Alteração aceita",
  steps: [
    { label: "Comando", detail: "Alterar voto registrado", icon: "warning" },
    { label: "API", detail: "Executa comando", icon: "api" },
    { label: "Banco central", detail: "Registro localizado", icon: "database" },
    { label: "Voto", detail: "Escolha modificada", icon: "ballot" },
    { label: "Resultado", detail: "Contagem alterada", icon: "audit" }
  ]
};

const eventNames: Record<VisualEventType, string> = {
  voter_registration: "Cadastro de eleitor",
  ballot_saved: "Configuração salva",
  election_locked: "Governança travada",
  election_lock_rejected: "Trava não aplicada",
  vote_cast: "Voto enviado",
  vote_rejected: "Voto bloqueado",
  receipt_verified: "Comprovante verificado",
  audit_recalculated: "Auditoria recalculada",
  vote_change_attempt: "Tentativa de alteração"
};

let connectionState: ConnectionState = "connecting";
let activeStep = -1;
let completedSteps = 0;
let currentFlow = idleFlow;
let currentEvent: VisualEvent | null = null;
let isPlaying = false;
let queue: VisualEvent[] = [];
let history: VisualEvent[] = [];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function icon(name: IconName) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]}</svg>`;
}

function statusLabel() {
  if (connectionState === "online") return "Conectado";
  if (connectionState === "offline") return "Reconectando";
  return "Conectando";
}

function eventSystemLabel(system: VisualSystem) {
  return system === "votifalho" ? "Votifalho" : "Votify";
}

function isFailureEvent(event: VisualEvent | null | undefined) {
  return Boolean(
    event &&
      (event.type === "vote_rejected" ||
        event.type === "election_lock_rejected" ||
        (event.type === "vote_change_attempt" && event.metadata?.accepted === false))
  );
}

function flowForEvent(event: VisualEvent) {
  if (event.type === "vote_change_attempt" && event.metadata?.accepted === false) {
    return blockedAttackFlow;
  }

  if (event.type === "vote_change_attempt" && event.metadata?.accepted === true) {
    return acceptedAttackFlow;
  }

  return flows[event.type];
}

function titleForEvent(event: VisualEvent) {
  if (event.type === "vote_change_attempt" && event.metadata?.accepted === false) {
    return "Ataque bloqueado";
  }

  if (event.type === "vote_change_attempt" && event.metadata?.accepted === true) {
    return "Alteração aceita";
  }

  return eventNames[event.type];
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function renderStep(step: FlowStep, index: number) {
  const failureIndex = currentFlow.failureStepIndex ?? currentFlow.steps.length - 1;
  const isErrorStep = isFailureEvent(currentEvent) && index === failureIndex;
  const stateClass = [
    index === activeStep ? "active" : "",
    index < completedSteps ? "done" : "",
    isErrorStep && index <= completedSteps ? "error" : ""
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <div class="flow-step ${stateClass}">
      <div class="step-icon">${icon(step.icon)}</div>
      <div>
        <strong>${escapeHtml(step.label)}</strong>
        <span>${escapeHtml(step.detail)}</span>
      </div>
    </div>
  `;
}

function renderHistory() {
  if (!history.length) {
    return `<div class="empty-feed">Nenhum evento recebido ainda.</div>`;
  }

  return history
    .map(
      (event) => `
        <div class="feed-item ${event.system === "votifalho" || isFailureEvent(event) ? "failure" : ""}">
          <span>${formatTime(event.occurredAt)}</span>
          <strong>${titleForEvent(event)}</strong>
          <small>${eventSystemLabel(event.system)}</small>
        </div>
      `
    )
    .join("");
}

function render() {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) return;

  const systemClass = currentEvent?.system === "votifalho" || isFailureEvent(currentEvent) ? "system-failure" : "system-secure";
  app.innerHTML = `
    <main class="shell ${systemClass}">
      <header class="topbar">
        <div class="brand-block">
          <img src="${logoVotifyUrl}" alt="Votify" />
        </div>
        <div class="connection ${connectionState}">
          <b></b>
          ${statusLabel()}
        </div>
      </header>

      <section class="stage">
        <div class="flow-card">
          <div class="flow-head">
            <h2>Visualizador</h2>
          </div>
          <div class="flow-grid">
            ${currentFlow.steps.map(renderStep).join("")}
          </div>
        </div>

        <aside class="feed">
          <h2>Eventos</h2>
          ${renderHistory()}
        </aside>
      </section>
    </main>
  `;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function playNext() {
  const event = queue.shift();
  if (!event) {
    isPlaying = false;
    activeStep = -1;
    render();
    return;
  }

  isPlaying = true;
  currentEvent = event;
  currentFlow = flowForEvent(event);
  const lastAnimatedStep =
    isFailureEvent(event) && typeof currentFlow.failureStepIndex === "number"
      ? currentFlow.failureStepIndex
      : currentFlow.steps.length - 1;
  activeStep = 0;
  completedSteps = 0;
  render();

  for (let index = 0; index <= lastAnimatedStep; index += 1) {
    activeStep = index;
    completedSteps = index;
    render();
    await delay(1050);
    completedSteps = index + 1;
    render();
    await delay(170);
  }

  activeStep = -1;
  completedSteps = lastAnimatedStep + 1;
  render();
  await delay(900);
  await playNext();
}

function enqueue(event: VisualEvent) {
  history = [event, ...history.filter((item) => item.id !== event.id)].slice(0, 10);
  queue.push(event);
  render();

  if (!isPlaying) {
    void playNext();
  }
}

function connect() {
  const source = new EventSource(`${API_BASE}/visual/events`);

  source.addEventListener("connected", (message) => {
    connectionState = "online";
    const payload = JSON.parse((message as MessageEvent).data) as { history?: VisualEvent[] };
    history = [...(payload.history ?? [])].reverse().slice(0, 10);
    render();
  });

  source.addEventListener("visual_event", (message) => {
    connectionState = "online";
    const event = JSON.parse((message as MessageEvent).data) as VisualEvent;
    enqueue(event);
  });

  source.addEventListener("heartbeat", () => {
    connectionState = "online";
    render();
  });

  source.onerror = () => {
    connectionState = "offline";
    render();
  };
}

render();
connect();
