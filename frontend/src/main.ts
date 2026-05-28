import "./styles.css";
import logoVotifalhoUrl from "./assets/logo-votifalho.png";
import logoVotifyUrl from "./assets/logo-votify.png";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3333/api/v1";
const POLLING_INTERVAL_MS = 3000;

type RouteName = "voto" | "configuracao" | "auditoria";
type SystemMode = "votify" | "votifalho";

type Election = {
  id: string;
  chainElectionId: string;
  title: string;
  status: string;
  candidates: Candidate[];
};

type Candidate = {
  id: string;
  name: string;
  number: string;
  description?: string | null;
};

type CandidateDraft = {
  id?: string;
  name: string;
  number: string;
};

type Receipt = {
  txid?: string;
  receipt_hash?: string;
  receiptHash?: string;
  confirmations?: number;
  blockheight?: number;
  blockhash?: string;
  status?: string;
};

type AuditReport = {
  chain?: string;
  chain_height?: number;
  election_id?: string;
  asset?: string;
  burn_address?: string;
  tokens_burned_by_vote_transactions?: number;
  votes_total?: number;
  votes_by_choice?: Record<string, number>;
  credentials_issued?: number;
  votes_match_burned_tokens?: boolean;
  min_vote_confirmations?: number | null;
  duplicate_votes?: number;
  centralized_records?: number;
  personal_data_exposed?: number;
};

type DemoVoter = {
  cpf: string;
  privateKey: string;
};

const DEMO_VOTERS_STORAGE_KEY = "votify_demo_voters";
const SYSTEM_MODE_STORAGE_KEY = "votify_system_mode";

function loadSystemMode(): SystemMode {
  return localStorage.getItem(SYSTEM_MODE_STORAGE_KEY) === "votifalho" ? "votifalho" : "votify";
}

function demoVotersStorageKey(mode: SystemMode) {
  return `${DEMO_VOTERS_STORAGE_KEY}:${mode}`;
}

function loadDemoVoters(mode: SystemMode): DemoVoter[] {
  const raw = localStorage.getItem(demoVotersStorageKey(mode));
  if (!raw) return [];

  try {
    const voters = JSON.parse(raw);
    if (!Array.isArray(voters)) return [];

    return voters.filter(
      (voter): voter is DemoVoter =>
        typeof voter?.cpf === "string" && typeof voter?.privateKey === "string"
    );
  } catch {
    return [];
  }
}

function saveDemoVoters(mode: SystemMode, voters: DemoVoter[]) {
  localStorage.setItem(demoVotersStorageKey(mode), JSON.stringify(voters));
}

const initialMode = loadSystemMode();

const state = {
  mode: initialMode,
  adminToken: "",
  electorToken: "",
  election: null as Election | null,
  configCpf: "",
  configPrivateKey: "",
  votePrivateKey: "",
  publicKey: "",
  selectedChoice: "",
  txid: "",
  receipt: null as Receipt | null,
  audit: null as AuditReport | null,
  demoVoters: loadDemoVoters(initialMode),
  ballotTitle: "",
  ballotCandidates: [] as CandidateDraft[],
  busy: false,
  initialized: false,
  error: ""
};

let polling = false;

function activeApiBase() {
  return state.mode === "votifalho" ? `${API_BASE}/traditional` : API_BASE;
}

function activeLogoUrl() {
  return state.mode === "votifalho" ? logoVotifalhoUrl : logoVotifyUrl;
}

function el<T extends HTMLElement>(selector: string) {
  return document.querySelector(selector) as T;
}

function route(): RouteName {
  const path = window.location.pathname.replace(/\/$/, "");
  if (path === "/configuracao") return "configuracao";
  if (path === "/auditoria") return "auditoria";
  return "voto";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${activeApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Erro inesperado na API.");
  }
  return body as T;
}

async function withBusy(task: () => Promise<void>) {
  state.busy = true;
  state.error = "";
  render();
  try {
    await task();
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Erro inesperado.";
  } finally {
    state.busy = false;
    render();
  }
}

async function login(email: string, password: string) {
  const result = await api<{ data: { accessToken: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return result.data.accessToken;
}

function syncBallotDraft() {
  state.ballotTitle = state.election?.title ?? "";
  state.ballotCandidates =
    state.election?.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      number: candidate.number
    })) ?? [];
}

function normalizeSelectedChoice() {
  const choices = state.election?.candidates ?? [];
  if (!choices.some((candidate) => candidate.number === state.selectedChoice)) {
    state.selectedChoice = "";
  }
}

function resetRuntimeStateForMode(mode: SystemMode) {
  state.mode = mode;
  state.adminToken = "";
  state.electorToken = "";
  state.election = null;
  state.publicKey = "";
  state.selectedChoice = "";
  state.txid = "";
  state.receipt = null;
  state.audit = null;
  state.demoVoters = loadDemoVoters(mode);
  state.ballotTitle = "";
  state.ballotCandidates = [];
  state.initialized = false;
  state.error = "";
}

async function switchMode(mode: SystemMode) {
  if (state.mode === mode || state.busy) return;

  localStorage.setItem(SYSTEM_MODE_STORAGE_KEY, mode);
  resetRuntimeStateForMode(mode);
  render();
  await initialize();
}

async function initialize() {
  if (state.initialized) return;

  await withBusy(async () => {
    state.adminToken = await login("admin@example.com", "demo123");
    state.electorToken = await login("elector@example.com", "demo123");

    const elections = await api<{ data: Election[] }>("/elections", {
      headers: { Authorization: `Bearer ${state.electorToken}` }
    });
    state.election = elections.data[0] ?? null;
    syncBallotDraft();
    normalizeSelectedChoice();
    state.initialized = true;
  });

  await refreshRouteData();
}

async function generatePublicKey() {
  const result = await api<{ data: { publicKey: string } }>("/crypto/public-key", {
    method: "POST",
    body: JSON.stringify({ privateKeySimulation: state.configPrivateKey })
  });
  state.publicKey = result.data.publicKey;
  return result.data.publicKey;
}

async function registerVoter() {
  if (!state.election) return;

  await withBusy(async () => {
    const publicKey = await generatePublicKey();
    await api(`/admin/elections/${state.election!.id}/voters`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.adminToken}` },
      body: JSON.stringify({
        cpf: state.configCpf,
        publicKey
      })
    });

    state.demoVoters = [{ cpf: state.configCpf, privateKey: state.configPrivateKey }, ...state.demoVoters];
    saveDemoVoters(state.mode, state.demoVoters);
  });
}

async function saveBallot() {
  if (!state.election) return;

  await withBusy(async () => {
    const result = await api<{ data: Election }>(`/admin/elections/${state.election!.id}/ballot`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${state.adminToken}` },
      body: JSON.stringify({
        title: state.ballotTitle,
        candidates: state.ballotCandidates
      })
    });

    state.election = result.data;
    syncBallotDraft();
    normalizeSelectedChoice();
  });
}

async function castVote() {
  if (!state.election || !state.selectedChoice) return;

  await withBusy(async () => {
    const result = await api<{ data: { txid: string; receipt: Receipt } }>(
      `/elections/${state.election!.id}/votes`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${state.electorToken}` },
        body: JSON.stringify({
          choice: state.selectedChoice,
          privateKeySimulation: state.votePrivateKey
        })
      }
    );

    state.txid = result.data.txid;
    state.receipt = result.data.receipt;
    await refreshAuditAndStatus();
  });
}

async function refreshReceipt() {
  if (!state.election || !state.txid) return;

  const result = await api<{ data: Receipt }>(
    `/elections/${state.election.id}/votes/${state.txid}/receipt`,
    {
      headers: { Authorization: `Bearer ${state.electorToken}` }
    }
  );
  state.receipt = result.data;
}

async function refreshAuditAndStatus() {
  if (!state.election || !state.adminToken) return;

  const audit = await api<{ data: AuditReport }>(`/elections/${state.election.id}/audit`, {
    headers: { Authorization: `Bearer ${state.adminToken}` }
  });
  state.audit = audit.data;
}

async function refreshRouteData() {
  const currentRoute = route();
  if (!state.initialized) return;
  if (currentRoute === "auditoria") {
    try {
      await refreshAuditAndStatus();
      render();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Erro inesperado.";
      render();
    }
  }
}

async function pollCurrentRoute() {
  const currentRoute = route();
  if (!state.initialized || state.busy || polling) return;

  polling = true;
  try {
    if (currentRoute === "auditoria") {
      await refreshAuditAndStatus();
      render();
      return;
    }

    if (currentRoute === "voto" && state.txid) {
      await refreshReceipt();
      render();
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Erro inesperado.";
    render();
  } finally {
    polling = false;
  }
}

function short(value?: string | null, start = 10, end = 8) {
  if (!value) return "-";
  return value.length > start + end + 3 ? `${value.slice(0, start)}...${value.slice(-end)}` : value;
}

function randomDigit() {
  return Math.floor(Math.random() * 10);
}

function randomCpf() {
  const digits = Array.from({ length: 11 }, () => randomDigit()).join("");
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function randomPrivateKey() {
  return Array.from({ length: 3 }, () => randomDigit()).join("");
}

function fillRandomVoter() {
  state.configCpf = randomCpf();
  state.configPrivateKey = randomPrivateKey();
  state.publicKey = "";
  render();
}

function clearDemoVoters() {
  state.demoVoters = [];
  localStorage.removeItem(demoVotersStorageKey(state.mode));
  render();
}

function clearVoteForm() {
  state.selectedChoice = "";
  state.votePrivateKey = "";
  state.txid = "";
  state.receipt = null;
  state.error = "";
  render();
}

function addCandidateDraft() {
  state.ballotCandidates = [...state.ballotCandidates, { name: "", number: "" }];
  render();
}

function removeCandidateDraft(index: number) {
  state.ballotCandidates = state.ballotCandidates.filter((_, itemIndex) => itemIndex !== index);
  render();
}

function candidateName(number: string) {
  return state.election?.candidates.find((candidate) => candidate.number === number)?.name ?? `Opção ${number}`;
}

function receiptStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending_stream_index: "Enviado",
    pending_block: "Aguardando confirmação",
    confirmed: "Confirmado",
    enviado: "Enviado"
  };

  return labels[status ?? ""] ?? "Enviado";
}

function renderCandidates() {
  if (!state.election?.candidates.length) return `<div class="empty-box"></div>`;

  return state.election.candidates
    .map(
      (candidate) => `
        <label class="candidate ${state.selectedChoice === candidate.number ? "selected" : ""}">
          <input type="radio" name="choice" value="${escapeHtml(candidate.number)}" ${
            state.selectedChoice === candidate.number ? "checked" : ""
          } />
          <span class="candidate-number">${escapeHtml(candidate.number)}</span>
          <span><strong>${escapeHtml(candidate.name)}</strong></span>
        </label>
      `
    )
    .join("");
}

function renderReceipt() {
  if (!state.txid) return `<div class="empty-box"></div>`;

  const receipt = state.receipt ?? {};
  const confirmations = receipt.confirmations ?? 0;
  const status = receipt.status ?? "enviado";
  const statusLabel = receiptStatusLabel(status);

  return `
    <div class="receipt-card">
      <div class="receipt-head">
        <span class="status-dot ${status === "confirmed" ? "ok" : ""}"></span>
        <strong>${statusLabel}</strong>
      </div>
      <div class="receipt-grid">
        <div><span>TXID</span><strong title="${escapeHtml(state.txid)}">${short(state.txid, 12, 10)}</strong></div>
        <div><span>Bloco</span><strong>${receipt.blockheight ?? "-"}</strong></div>
        <div><span>Confirmações</span><strong>${confirmations}</strong></div>
        <div><span>Hash</span><strong title="${escapeHtml(receipt.receipt_hash ?? receipt.receiptHash ?? "")}">${short(
          receipt.receipt_hash ?? receipt.receiptHash,
          12,
          10
        )}</strong></div>
      </div>
    </div>
  `;
}

function renderMetric(label: string, value: string | number, extraClass = "") {
  return `
    <div class="metric ${extraClass}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderVoteResults() {
  const votes = state.audit?.votes_by_choice ?? {};
  const entries = state.election?.candidates.length
    ? state.election.candidates.map((candidate) => [candidate.number, votes[candidate.number] ?? 0] as const)
    : (Object.entries(votes) as [string, number][]);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  return `
    <div class="result-list">
      ${entries
        .map(([choice, count]) => {
          const width = count === 0 ? 0 : Math.max(8, (count / max) * 100);
          return `
            <div class="result-row">
              <div>
                <strong>${escapeHtml(candidateName(choice))}</strong>
                <span>${escapeHtml(choice)}</span>
              </div>
              <div class="bar"><i style="width: ${width}%"></i></div>
              <b>${count}</b>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAuditSummary() {
  const audit = state.audit;
  if (!audit) return `<div class="empty-box"></div>`;

  const votesTotal = audit.votes_total ?? 0;
  const credentialsIssued = audit.credentials_issued ?? 0;
  const burnedTokens = audit.tokens_burned_by_vote_transactions ?? 0;

  if (state.mode === "votifalho") {
    return `
      <div class="metrics">
        ${renderMetric("Votos no banco", votesTotal)}
        ${renderMetric("Eleitores no banco", credentialsIssued)}
        ${renderMetric("Duplicidades aceitas", audit.duplicate_votes ?? 0)}
        ${renderMetric("Blockchain", "não usada")}
      </div>
      <section class="audit-section">
        <h3>Contagem</h3>
        ${renderVoteResults()}
      </section>
    `;
  }

  return `
    <div class="metrics">
      ${renderMetric("Votos apurados", votesTotal)}
      ${renderMetric("Credenciais emitidas", credentialsIssued)}
      ${renderMetric("Tokens consumidos", burnedTokens)}
      ${renderMetric("Blocos da rede", audit.chain_height ?? "-")}
    </div>
    <section class="audit-section">
      <h3>Contagem</h3>
      ${renderVoteResults()}
    </section>
  `;
}

function renderVotePage() {
  return `
    <section class="single">
      <article class="panel">
        <div class="panel-title">
          <h2>Voto</h2>
        </div>
        <label>
          Chave Privada
          <input id="votePrivateKey" value="${escapeHtml(state.votePrivateKey)}" />
        </label>
        <div class="candidates">
          ${renderCandidates()}
        </div>
        <div class="vote-actions">
          <button id="clearVote" class="secondary" ${state.busy ? "disabled" : ""}>Limpar</button>
          <button id="castVote" class="primary" ${!state.election || !state.selectedChoice || state.busy ? "disabled" : ""}>Votar</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-title">
          <h2>Comprovante</h2>
        </div>
        ${renderReceipt()}
      </article>
    </section>
  `;
}

function renderCandidateEditor() {
  return `
    <div class="option-list">
      ${state.ballotCandidates
        .map(
          (candidate, index) => `
            <div class="option-row">
              <input class="option-number" data-candidate-number="${index}" value="${escapeHtml(candidate.number)}" />
              <input class="option-name" data-candidate-name="${index}" value="${escapeHtml(candidate.name)}" />
              <button class="secondary icon-button" data-remove-candidate="${index}" ${
                state.ballotCandidates.length <= 1 || state.busy ? "disabled" : ""
              }>Remover</button>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderConfigPage() {
  return `
    <div class="page-action">
      <a href="/" class="back-link">Voltar</a>
    </div>
    <section class="config-page">
      <div class="config-stack">
        <article class="panel">
          <div class="panel-title">
            <h2>Cadastro</h2>
          </div>
          <label>
            CPF
            <input id="configCpf" value="${escapeHtml(state.configCpf)}" />
          </label>
          <label>
            Chave Privada
            <input id="configPrivateKey" value="${escapeHtml(state.configPrivateKey)}" />
          </label>
          <div class="form-actions">
            <button id="randomVoter" class="secondary" ${state.busy ? "disabled" : ""}>Gerar dados</button>
            <button id="registerVoter" class="primary" ${!state.election || state.busy ? "disabled" : ""}>Cadastrar eleitor</button>
          </div>
          ${
            state.publicKey
              ? `<div class="key-box"><span>Chave pública</span><strong>${short(state.publicKey, 16, 14)}</strong></div>`
              : ""
          }
        </article>

        <article class="panel">
          <div class="panel-title">
            <h2>Eleição</h2>
          </div>
          <label>
            Título
            <input id="ballotTitle" value="${escapeHtml(state.ballotTitle)}" />
          </label>
          <div class="option-title">
            <strong>Opções de voto</strong>
          </div>
          ${renderCandidateEditor()}
          <div class="form-actions">
            <button id="addCandidate" class="secondary" ${state.busy ? "disabled" : ""}>Adicionar opção</button>
            <button id="saveBallot" class="primary" ${!state.election || state.busy ? "disabled" : ""}>Salvar eleição</button>
          </div>
        </article>
      </div>

      <article class="panel">
        <div class="panel-title">
          <h2>Eleitores</h2>
        </div>
        <div class="voter-list">
          ${state.demoVoters
            .map(
              (voter) => `
                <div class="voter-item">
                  <span>${escapeHtml(voter.cpf)}</span>
                  <strong>${escapeHtml(voter.privateKey)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
        <button id="clearVoters" class="secondary full" ${state.demoVoters.length === 0 || state.busy ? "disabled" : ""}>Limpar lista</button>
      </article>
    </section>
  `;
}

function renderAuditPage() {
  return `
    <div class="page-action">
      <a href="/" class="back-link">Voltar</a>
    </div>
    <section class="audit-layout">
      <article class="panel audit-panel">
        <div class="panel-title">
          <h2>Auditoria</h2>
        </div>
        ${renderAuditSummary()}
      </article>
    </section>
  `;
}

function renderModeSwitch() {
  const nextMode = state.mode === "votify" ? "votifalho" : "votify";

  return `
    <button
      id="modeSwitch"
      class="mode-switch ${state.mode === "votifalho" ? "on" : ""}"
      aria-label="Alternar modo do sistema"
      title="Alternar modo do sistema"
      data-next-mode="${nextMode}"
      ${state.busy ? "disabled" : ""}
    >
      <span></span>
    </button>
  `;
}

function renderPage() {
  const currentRoute = route();
  if (currentRoute === "configuracao") return renderConfigPage();
  if (currentRoute === "auditoria") return renderAuditPage();
  return renderVotePage();
}

function bindCommonEvents() {
  const votePrivateKey = document.querySelector<HTMLInputElement>("#votePrivateKey");
  if (votePrivateKey) {
    votePrivateKey.oninput = (event) => {
      state.votePrivateKey = (event.target as HTMLInputElement).value;
    };
  }

  const configPrivateKey = document.querySelector<HTMLInputElement>("#configPrivateKey");
  if (configPrivateKey) {
    configPrivateKey.oninput = (event) => {
      state.configPrivateKey = (event.target as HTMLInputElement).value;
      state.publicKey = "";
    };
  }

  const configCpf = document.querySelector<HTMLInputElement>("#configCpf");
  if (configCpf) {
    configCpf.oninput = (event) => {
      state.configCpf = (event.target as HTMLInputElement).value;
    };
  }

  const ballotTitle = document.querySelector<HTMLInputElement>("#ballotTitle");
  if (ballotTitle) {
    ballotTitle.oninput = (event) => {
      state.ballotTitle = (event.target as HTMLInputElement).value;
    };
  }

  document.querySelectorAll<HTMLInputElement>("[data-candidate-number]").forEach((input) => {
    input.oninput = () => {
      const index = Number(input.dataset.candidateNumber);
      state.ballotCandidates[index].number = input.value;
    };
  });

  document.querySelectorAll<HTMLInputElement>("[data-candidate-name]").forEach((input) => {
    input.oninput = () => {
      const index = Number(input.dataset.candidateName);
      state.ballotCandidates[index].name = input.value;
    };
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeCandidate);
      removeCandidateDraft(index);
    });
  });

  document.querySelectorAll<HTMLInputElement>("input[name='choice']").forEach((input) => {
    input.onchange = () => {
      state.selectedChoice = input.value;
      render();
    };
  });

  document.querySelector<HTMLButtonElement>("#saveBallot")?.addEventListener("click", () => void saveBallot());
  document.querySelector<HTMLButtonElement>("#addCandidate")?.addEventListener("click", () => addCandidateDraft());
  document.querySelector<HTMLButtonElement>("#registerVoter")?.addEventListener("click", () => void registerVoter());
  document.querySelector<HTMLButtonElement>("#randomVoter")?.addEventListener("click", () => fillRandomVoter());
  document.querySelector<HTMLButtonElement>("#clearVoters")?.addEventListener("click", () => clearDemoVoters());
  document.querySelector<HTMLButtonElement>("#clearVote")?.addEventListener("click", () => clearVoteForm());
  document.querySelector<HTMLButtonElement>("#castVote")?.addEventListener("click", () => void castVote());
  document.querySelector<HTMLButtonElement>("#modeSwitch")?.addEventListener("click", (event) => {
    const nextMode = (event.currentTarget as HTMLButtonElement).dataset.nextMode;
    if (nextMode === "votify" || nextMode === "votifalho") {
      void switchMode(nextMode);
    }
  });
}

function render() {
  const app = el<HTMLElement>("#app");
  const currentRoute = route();

  app.innerHTML = `
    <section class="shell ${state.mode === "votifalho" ? "mode-failure" : "mode-secure"}">
      <header class="topbar">
        <a class="brand" href="/" aria-label="Votify">
          <img src="${activeLogoUrl()}" alt="${state.mode === "votifalho" ? "Votifalho" : "Votify"}" />
        </a>
        ${renderModeSwitch()}
      </header>

      ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ""}
      ${renderPage()}

      <footer class="footer-links">
        <a class="${currentRoute === "configuracao" ? "active" : ""}" href="/configuracao">Configuração</a>
        <a class="${currentRoute === "auditoria" ? "active" : ""}" href="/auditoria">Auditoria</a>
      </footer>
    </section>
  `;

  bindCommonEvents();
}

window.addEventListener("popstate", () => {
  render();
  void refreshRouteData();
});

document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest("a");
  if (!link || link.origin !== window.location.origin) return;
  event.preventDefault();
  window.history.pushState({}, "", link.href);
  render();
  void refreshRouteData();
});

render();
void initialize();
window.setInterval(() => void pollCurrentRoute(), POLLING_INTERVAL_MS);
