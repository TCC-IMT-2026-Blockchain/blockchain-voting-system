import "./styles.css";
import logoVotifyUrl from "./assets/logo-votify.png";
import logoVotifalhoUrl from "./assets/logo-votifalho.png";
import faviconVotifyUrl from "./assets/votify_logo.png";
import faviconVotifalhoUrl from "./assets/votifalho_logo.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3333/api/v1";

type RouteName = "voto" | "configuracao" | "auditoria" | "admin";
type SystemMode = "votify" | "votifalho";

type Election = {
  id: string;
  chainElectionId: string;
  title: string;
  status: string;
  candidates: Candidate[];
  governanceLockedAt?: string | null;
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
  compromised_report?: boolean;
  compromise_note?: string;
};

type NodeAudit = {
  id: "master" | "fiscal-1" | "fiscal-2";
  name: string;
  container: string;
  role: "master" | "fiscal";
  status: "online" | "compromised" | "offline" | "starting";
  compromised: boolean;
  audit: AuditReport | null;
  fingerprint: string | null;
  error?: string;
};

type ConsensusAudit = {
  nodes: NodeAudit[];
  majority: {
    status: "majority" | "no_majority";
    fingerprint: string | null;
    audit: AuditReport | null;
    nodeIds: string[];
    divergentNodeIds: string[];
    offlineNodeIds: string[];
  };
};

type AttackResult = {
  system: SystemMode;
  attack: "change_vote";
  status: "accepted" | "blocked";
  message: string;
  reason?: string;
  targetTxid?: string;
  modifiedTxid?: string;
  forgedTxid?: string;
  before?: AuditReport;
  after?: AuditReport;
};

type NodeCommandResult = {
  system: SystemMode;
  command: string;
  status: "accepted" | "blocked" | "ok";
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  audit?: AuditReport;
  before?: AuditReport;
  after?: AuditReport;
};

type DemoVoter = {
  cpf: string;
  pin?: string;
  privateKey?: string;
  electionId?: string;
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
        typeof voter?.cpf === "string" && (typeof voter?.pin === "string" || typeof voter?.privateKey === "string")
    );
  } catch {
    return [];
  }
}

function saveDemoVoters(mode: SystemMode, voters: DemoVoter[]) {
  localStorage.setItem(demoVotersStorageKey(mode), JSON.stringify(voters));
}

function addDemoVoterToMode(mode: SystemMode, voter: DemoVoter) {
  const voters = loadDemoVoters(mode).filter(
    (item) => item.cpf !== voter.cpf
  );
  const updated = [voter, ...voters];
  saveDemoVoters(mode, updated);
  return updated;
}

const initialMode = loadSystemMode();

const state = {
  mode: initialMode,
  adminToken: "",
  electorToken: "",
  election: null as Election | null,
  configCpf: "",
  voteCpf: "",
  votePin: "",
  selectedChoice: "",
  txid: "",
  receipt: null as Receipt | null,
  audit: null as AuditReport | null,
  consensus: null as ConsensusAudit | null,
  attackFromChoice: "",
  attackToChoice: "",
  attackResult: null as AttackResult | null,
  nodeCommand: "",
  nodeCommandResult: null as NodeCommandResult | null,
  demoVoters: loadDemoVoters(initialMode),
  ballotTitle: "",
  ballotCandidates: [] as CandidateDraft[],
  auditSearchTxid: "",
  auditSearchHash: "",
  targetNodeId: "fiscal-2",
  auditSearchResult: null as Receipt | null,
  auditSearchError: "",
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

function isElectionLocked() {
  return Boolean(state.election?.governanceLockedAt);
}

function el<T extends HTMLElement>(selector: string) {
  return document.querySelector(selector) as T;
}

function route(): RouteName {
  const path = window.location.pathname.replace(/\/$/, "");
  if (path === "/configuracao") return "configuracao";
  if (path === "/auditoria") return "auditoria";
  if (path === "/admin") return "admin";
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
  let response: Response;
  try {
    response = await fetch(`${activeApiBase()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Não foi possível conectar ao servidor. O Backend (porta 3333) pode estar offline ou indisponível.");
    }
    throw error;
  }

  const text = await response.text();
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  let body: any = null;

  if (text && isJson) {
    body = JSON.parse(text);
  } else if (text && !isJson) {
    throw new Error("Resposta inesperada do servidor. Verifique se a aplicação não sofreu um erro interno fatal.");
  }

  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Erro desconhecido retornado pelo servidor.");
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

function normalizeAttackChoices() {
  const choices = state.election?.candidates ?? [];
  if (!choices.length) {
    state.attackFromChoice = "";
    state.attackToChoice = "";
    return;
  }

  if (!choices.some((candidate) => candidate.number === state.attackFromChoice)) {
    state.attackFromChoice = choices[0]?.number ?? "";
  }

  if (
    !choices.some((candidate) => candidate.number === state.attackToChoice) ||
    state.attackToChoice === state.attackFromChoice
  ) {
    state.attackToChoice = choices.find((candidate) => candidate.number !== state.attackFromChoice)?.number ?? "";
  }
}

function resetRuntimeStateForMode(mode: SystemMode) {
  state.mode = mode;
  state.adminToken = "";
  state.electorToken = "";
  state.election = null;
  state.voteCpf = "";
  state.votePin = "";
  state.selectedChoice = "";
  state.txid = "";
  state.receipt = null;
  state.audit = null;
  state.consensus = null;
  state.attackFromChoice = "";
  state.attackToChoice = "";
  state.attackResult = null;
  state.nodeCommand = "";
  state.nodeCommandResult = null;
  state.demoVoters = loadDemoVoters(mode);
  state.ballotTitle = "";
  state.ballotCandidates = [];
  state.auditSearchTxid = "";
  state.auditSearchHash = "";
  state.auditSearchResult = null;
  state.auditSearchError = "";
  state.initialized = false;
  state.error = "";
}

async function switchMode(mode: SystemMode) {
  if (state.mode === mode || state.busy) return;

  localStorage.setItem(SYSTEM_MODE_STORAGE_KEY, mode);
  resetRuntimeStateForMode(mode);
  
  document.title = mode === "votifalho" ? "Votifalho" : "Votify";
  const faviconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (faviconLink) {
    faviconLink.href = mode === "votifalho" ? faviconVotifalhoUrl : faviconVotifyUrl;
  }
  
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
    if (state.election) {
      state.demoVoters = state.demoVoters.filter(v => v.electionId === state.election!.id);
      saveDemoVoters(state.mode, state.demoVoters);
    }

    syncBallotDraft();
    normalizeSelectedChoice();
    normalizeAttackChoices();
    state.initialized = true;
  });

  await refreshRouteData();
}



async function registerVoter() {
  if (!state.election || isElectionLocked()) return;

  await withBusy(async () => {
    const cpfToSave = state.configCpf;
    const result = await api<{ data: { pin: string } }>(`/admin/elections/${state.election!.id}/voters`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.adminToken}` },
      body: JSON.stringify({
        cpf: cpfToSave
      })
    });

    state.configCpf = "";
    
    const voter = { cpf: cpfToSave, pin: result.data.pin, electionId: state.election!.id };
    state.demoVoters = addDemoVoterToMode(state.mode, voter);
    if (state.mode === "votify") {
      addDemoVoterToMode("votifalho", voter);
    }
  });
}

async function saveBallot() {
  if (!state.election || isElectionLocked()) return;

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
    normalizeAttackChoices();
  });
}

async function lockElection() {
  if (!state.election || state.mode !== "votify" || isElectionLocked()) return;

  await withBusy(async () => {
    const result = await api<{ data: { election: Election } }>(`/admin/elections/${state.election!.id}/lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.adminToken}` }
    });

    state.election = result.data.election;
    syncBallotDraft();
    normalizeSelectedChoice();
    normalizeAttackChoices();
    await refreshAuditAndStatus();
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
          cpf: state.voteCpf,
          pin: state.votePin
        })
      }
    );

    state.txid = result.data.txid;
    state.receipt = result.data.receipt;
    state.auditSearchTxid = "";
    state.auditSearchHash = "";
    state.auditSearchResult = null;
    state.auditSearchError = "";
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
  
  const wasOptimistic = state.receipt?.status === "confirmed" && result.data.status !== "confirmed";
  state.receipt = result.data;
  
  if (wasOptimistic) {
    state.receipt.status = "confirmed";
    state.receipt.confirmations = Math.max(1, state.receipt.confirmations ?? 0);
  }
}

async function refreshAuditAndStatus(visual = false) {
  if (!state.election || !state.adminToken) return;

  const audit = await api<{ data: AuditReport }>(`/elections/${state.election.id}/audit${visual ? "?visual=1" : ""}`, {
    headers: { Authorization: `Bearer ${state.adminToken}` }
  });
  state.audit = audit.data;

  if (state.mode === "votify") {
    const consensus = await api<{ data: ConsensusAudit }>(
      `/elections/${state.election.id}/audit/consensus${visual ? "?visual=1" : ""}`,
      {
        headers: { Authorization: `Bearer ${state.adminToken}` }
      }
    );
    state.consensus = consensus.data;
  } else {
    state.consensus = null;
  }
}

async function refreshRouteData() {
  const currentRoute = route();
  if (!state.initialized) return;
  if (currentRoute === "auditoria" || currentRoute === "admin") {
    try {
      await refreshAuditAndStatus();
      normalizeAttackChoices();
      state.error = "";
      render();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Erro inesperado.";
      render();
    }
  }
}

async function pollCurrentRoute() {
  const currentRoute = route();
  if (!state.initialized || polling) return;

  if (state.busy) {
    if (currentRoute === "voto" && state.txid) {
      setTimeout(() => void pollCurrentRoute(), 1000);
    }
    return;
  }

  polling = true;
  try {
    if (currentRoute === "auditoria" || currentRoute === "admin") {
      await refreshAuditAndStatus();
      state.error = "";
      render();
      return;
    }

    if (currentRoute === "voto" && state.txid) {
      await refreshReceipt();
      state.error = "";
      render();
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Erro inesperado.";
    render();
  } finally {
    polling = false;
    
    // Always reschedule if we are still on a polling route
    if (route() === "voto" && state.txid) {
      setTimeout(() => {
        if (route() === "voto") void pollCurrentRoute();
      }, 3000);
    }
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

function fillRandomVoter() {
  state.configCpf = randomCpf();
  render();
}

function clearDemoVoters() {
  state.demoVoters = [];
  localStorage.removeItem(demoVotersStorageKey(state.mode));
  render();
}

function clearVoteForm() {
  state.selectedChoice = "";
  state.voteCpf = "";
  state.votePin = "";
  state.txid = "";
  state.receipt = null;
  state.auditSearchTxid = "";
  state.auditSearchHash = "";
  state.auditSearchResult = null;
  state.auditSearchError = "";
  state.error = "";
  render();
}

async function executeChangeVoteAttack() {
  if (!state.election || !state.attackFromChoice || !state.attackToChoice) return;

  await withBusy(async () => {
    const result = await api<{ data: AttackResult }>("/maintenance/change-vote", {
      method: "POST",
      body: JSON.stringify({
        electionId: state.election!.id,
        fromChoice: state.attackFromChoice,
        toChoice: state.attackToChoice
      })
    });

    state.attackResult = result.data;
    await refreshAuditAndStatus();
  });
}

async function executeNodeCommand() {
  if (!state.election || !state.nodeCommand.trim()) return;

  await withBusy(async () => {
    const result = await api<{ data: NodeCommandResult }>("/maintenance/node-command", {
      method: "POST",
      body: JSON.stringify({
        electionId: state.election!.id,
        command: state.nodeCommand.trim()
      })
    });

    state.nodeCommandResult = result.data;
    await refreshAuditAndStatus();
  });
}

async function executeCompromiseCentralDb() {
  if (!state.election || state.mode !== "votifalho") return;

  const choice = state.election.candidates[0]?.number ?? "1";
  await withBusy(async () => {
    const result = await api<{ data: NodeCommandResult }>("/maintenance/node-command", {
      method: "POST",
      body: JSON.stringify({
        electionId: state.election!.id,
        command: "comprometer-banco"
      })
    });

    state.nodeCommandResult = result.data;
    await refreshAuditAndStatus();
  });
}

async function compromiseFiscalNode() {
  if (!state.election || state.mode !== "votify") return;

  const choice = state.election.candidates[0]?.number ?? "1";
  await withBusy(async () => {
    await api(`/admin/nodes/${state.targetNodeId}/compromise-audit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.adminToken}` },
      body: JSON.stringify({
        electionId: state.election!.id,
        choice,
        amount: 10
      })
    });
    await refreshAuditAndStatus();
  });
}

async function stopFiscalNode() {
  if (state.mode !== "votify") return;

  await withBusy(async () => {
    await api(`/admin/nodes/${state.targetNodeId}/offline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.adminToken}` }
    });
    await refreshAuditAndStatus();
  });
}

async function restoreFiscalNode() {
  if (state.mode !== "votify") return;

  await withBusy(async () => {
    await api(`/admin/nodes/${state.targetNodeId}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.adminToken}` }
    });
    await refreshAuditAndStatus();
  });
}

function addCandidateDraft() {
  if (isElectionLocked()) return;
  state.ballotCandidates = [...state.ballotCandidates, { name: "", number: "" }];
  render();
}

function removeCandidateDraft(index: number) {
  if (isElectionLocked()) return;
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
    registered: "Registrado",
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
  const isRegistered = status === "confirmed" || status === "registered";

  if (state.mode === "votifalho") {
    return `
      <div class="receipt-card">
        <div class="receipt-head">
          <span class="status-dot ${isRegistered ? "ok" : ""}"></span>
          <strong>${statusLabel}</strong>
        </div>
        <div class="receipt-grid">
          <div><span>ID do registro</span><strong class="selectable">${escapeHtml(state.txid)}</strong></div>
          <div><span>Status</span><strong>${statusLabel}</strong></div>
          <div><span>Hash local</span><strong class="selectable">${escapeHtml(receipt.receipt_hash ?? receipt.receiptHash ?? "")}</strong></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="receipt-card">
      <div class="receipt-head">
        <span class="status-dot ${isRegistered ? "ok" : ""}"></span>
        <strong>${statusLabel}</strong>
      </div>
      <div class="receipt-grid">
        <div><span>TXID</span><strong class="selectable">${escapeHtml(state.txid)}</strong></div>
        <div><span>Bloco</span><strong>${receipt.blockheight ?? "-"}</strong></div>
        <div><span>Confirmações</span><strong>${confirmations}</strong></div>
        <div><span>Hash</span><strong class="selectable">${escapeHtml(receipt.receipt_hash ?? receipt.receiptHash ?? "")}</strong></div>
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

function renderVoteResultsFor(votes: Record<string, number> = {}) {
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

function renderVoteResults() {
  return renderVoteResultsFor(state.audit?.votes_by_choice ?? {});
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
  `;
}

function nodeStatusLabel(status: NodeAudit["status"]) {
  if (status === "compromised") return "comprometido";
  if (status === "starting") return "inicializando";
  if (status === "offline") return "offline";
  return "online";
}

function nodeShortName(id: string) {
  if (id === "master") return "Nó 1";
  if (id === "fiscal-1") return "Nó 2";
  if (id === "fiscal-2") return "Nó 3";
  return id;
}

function nodeUnavailableMessage(node: NodeAudit) {
  if (node.status === "offline") return "Nó offline. A contagem continua pelos outros nós.";
  if (node.status === "starting") return "Nó inicializando. Aguarde alguns segundos.";
  return node.error ?? "Nó indisponível.";
}

function renderNodeAuditCard(node: NodeAudit) {
  const statusClass = node.status === "online" ? "ok" : node.status === "compromised" ? "danger" : "muted";

  return `
    <div class="node-audit-card ${node.status}">
      <div class="node-audit-head">
        <strong>${escapeHtml(node.name)}</strong>
        <span class="${statusClass}">${nodeStatusLabel(node.status)}</span>
      </div>
      ${
        node.audit
          ? `${renderVoteResultsFor(node.audit.votes_by_choice ?? {})}
             ${
               node.audit.compromise_note
                 ? `<p class="node-note">${escapeHtml(node.audit.compromise_note)}</p>`
                 : ""
             }`
          : `<div class="empty-box small node-error">${escapeHtml(nodeUnavailableMessage(node))}</div>`
      }
    </div>
  `;
}

function renderNodeControls() {
  return `
    <div class="consensus-actions">
      <select id="targetNode" ${state.busy ? "disabled" : ""}>
        <option value="master" ${state.targetNodeId === "master" ? "selected" : ""}>Nó 1 (Master)</option>
        <option value="fiscal-1" ${state.targetNodeId === "fiscal-1" ? "selected" : ""}>Nó 2 (Fiscal 1)</option>
        <option value="fiscal-2" ${state.targetNodeId === "fiscal-2" ? "selected" : ""}>Nó 3 (Fiscal 2)</option>
      </select>
      <button id="compromiseNode" class="secondary" ${state.busy ? "disabled" : ""}>Comprometer</button>
      <button id="stopNode" class="secondary" ${state.busy ? "disabled" : ""}>Derrubar</button>
      <button id="restoreNode" class="primary" ${state.busy ? "disabled" : ""}>Restaurar</button>
    </div>
  `;
}

function renderConsensusPanel(showNodeControls = false) {
  if (state.mode !== "votify") return "";
  const consensus = state.consensus;
  if (!consensus) {
    return `
      <section class="audit-section">
        <h3>Contagem</h3>
        ${showNodeControls ? renderNodeControls() : ""}
        <div class="empty-box"></div>
      </section>
    `;
  }

  const majorityAudit = consensus.majority.audit;
  const hasMajority = consensus.majority.status === "majority" && majorityAudit;

  return `
    <section class="audit-section">
      <h3>Contagem</h3>
      ${showNodeControls ? renderNodeControls() : ""}
      <div class="node-audit-grid">
        ${consensus.nodes.map(renderNodeAuditCard).join("")}
      </div>
      <div class="majority-box ${hasMajority ? "ok" : "danger"}">
        <div class="node-audit-head">
          <strong>Resultado por maioria</strong>
          <span>${hasMajority ? consensus.majority.nodeIds.map(nodeShortName).join(" + ") : "sem maioria"}</span>
        </div>
        ${
          hasMajority
            ? renderVoteResultsFor(majorityAudit.votes_by_choice ?? {})
            : `<div class="empty-box small">Não há nós suficientes concordando.</div>`
        }
        ${
          consensus.majority.divergentNodeIds.length
            ? `<p class="node-note">Divergente: ${consensus.majority.divergentNodeIds.map(nodeShortName).join(", ")}</p>`
            : ""
        }
        ${
          consensus.majority.offlineNodeIds.length
            ? `<p class="node-note">Offline: ${consensus.majority.offlineNodeIds.map(nodeShortName).join(", ")}</p>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderCandidateEditor() {
  const locked = isElectionLocked();
  return `
    <div class="option-list">
      ${state.ballotCandidates
        .map(
          (candidate, index) => `
            <div class="option-row">
              <input class="option-number" data-candidate-number="${index}" value="${escapeHtml(candidate.number)}" ${locked ? "disabled" : ""} />
              <input class="option-name" data-candidate-name="${index}" value="${escapeHtml(candidate.name)}" ${locked ? "disabled" : ""} />
              <button class="secondary icon-button" data-remove-candidate="${index}" ${
                state.busy || locked ? "disabled" : ""
              }>Remover</button>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderConfigPage() {
  const locked = isElectionLocked();
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
            <input id="configCpf" value="${escapeHtml(state.configCpf)}" ${locked ? "disabled" : ""} />
          </label>
          <div class="form-actions">
            <button id="randomVoter" class="secondary" ${state.busy || locked ? "disabled" : ""}>Gerar dados</button>
            <button id="registerVoter" class="primary" ${!state.election || state.busy || locked ? "disabled" : ""}>Cadastrar eleitor</button>
          </div>
        </article>

        <article class="panel">
          <div class="panel-title">
            <h2>Eleição</h2>
          </div>
          <label>
            Título
            <input id="ballotTitle" value="${escapeHtml(state.ballotTitle)}" ${locked ? "disabled" : ""} />
          </label>
          <div class="option-title">
            <strong>Opções de voto</strong>
          </div>
          ${renderCandidateEditor()}
          <div class="form-actions">
            <button id="addCandidate" class="secondary" ${state.busy || locked ? "disabled" : ""}>Adicionar opção</button>
            <button id="saveBallot" class="primary" ${!state.election || state.busy || locked ? "disabled" : ""}>Salvar eleição</button>
          </div>
          ${
            state.mode === "votify"
              ? `<div class="lock-row">
                  <span>${locked ? "Eleição travada" : "Configuração aberta"}</span>
                  <button id="lockElection" class="primary" ${!state.election || state.busy || locked ? "disabled" : ""}>${
                    locked ? "Travada" : "Travar eleição"
                  }</button>
                </div>`
              : ""
          }
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
                  <strong>${escapeHtml(voter.pin || voter.privateKey || "")}</strong>
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

async function searchAuditTxid() {
  if (!state.election || !state.auditSearchTxid) return;
  
  await withBusy(async () => {
    state.auditSearchResult = null;
    state.auditSearchError = "";
    try {
      const result = await api<{ data: Receipt }>(
        `/elections/${state.election!.id}/votes/${state.auditSearchTxid.trim()}/receipt?visual=1`,
        {
          headers: { Authorization: `Bearer ${state.adminToken}` }
        }
      );
      state.auditSearchResult = result.data;
    } catch (error) {
      state.auditSearchError = error instanceof Error ? error.message : "Comprovante não encontrado.";
    }
  });
}

function renderAuditSearch() {
  const result = state.auditSearchResult;
  const error = state.auditSearchError;

  let resultHtml = "";
  if (error) {
    resultHtml = `<div class="notice error" style="margin-top: 1rem;">${escapeHtml(error)}</div>`;
  } else if (result) {
    const isRegistered = result.status === "confirmed" || result.status === "registered";
    const confirmations = result.confirmations ?? 0;
    const remoteHash = result.receipt_hash ?? result.receiptHash ?? "";
    const localHash = state.auditSearchHash.trim();
    
    let hashStatusHtml = "";
    if (localHash) {
      if (localHash === remoteHash) {
        hashStatusHtml = `<div class="notice success" style="margin-top: 1rem;"><strong>Dupla Verificação de Integridade Confirmada.</strong> O bloco que contém seu voto permanece imutável.</div>`;
      } else {
        hashStatusHtml = `<div class="notice error" style="margin-top: 1rem;"><strong>Alerta de Integridade:</strong> O Hash local não bate com o estado atual da rede. Pode indicar que o bloco original foi alterado (reescrita de cadeia).</div>`;
      }
    }

    resultHtml = `
      <div class="receipt-card" style="margin-top: 1rem;">
        <div class="receipt-head">
          <span class="status-dot ${isRegistered ? "ok" : ""}"></span>
          <strong>Transação Válida</strong>
        </div>
        <p style="margin-bottom: 0;">O voto referente a este TXID está incorruptível, registrado no bloco <strong>${result.blockheight ?? "-"}</strong> com <strong>${confirmations}</strong> confirmação(ões) e o token de voto foi consumido.</p>
        ${hashStatusHtml}
      </div>
    `;
  }

  return `
    <article class="panel">
      <div class="panel-title">
        <h2>Verificar Integridade do Voto</h2>
      </div>
      <label>
        TXID do Comprovante (Obrigatório)
        <input id="auditSearchTxid" value="${escapeHtml(state.auditSearchTxid)}" placeholder="Cole seu TXID aqui..." ${state.busy ? "disabled" : ""} />
      </label>
      <label>
        Hash Local do Comprovante (Opcional)
        <input id="auditSearchHash" value="${escapeHtml(state.auditSearchHash)}" placeholder="receipt_hash (opcional)..." ${state.busy ? "disabled" : ""} />
      </label>
      <div class="form-actions" style="margin-top: 1rem;">
        <button id="searchAuditTxid" class="primary" ${!state.election || !state.auditSearchTxid || state.busy ? "disabled" : ""}>Verificar Integridade</button>
      </div>
      ${resultHtml}
    </article>
  `;
}

function renderVoteIntegrityWidget() {
  const result = state.auditSearchResult;
  const error = state.auditSearchError;

  let resultHtml = "";
  if (error) {
    resultHtml = `<div class="notice error integrity-notice">${escapeHtml(error)}</div>`;
  } else if (result) {
    const isRegistered = result.status === "confirmed" || result.status === "registered";
    const confirmations = result.confirmations ?? 0;
    const remoteHash = result.receipt_hash ?? result.receiptHash ?? "";
    const localHash = state.auditSearchHash.trim();

    let hashStatusHtml = "";
    if (localHash) {
      hashStatusHtml =
        localHash === remoteHash
          ? `<div class="notice success integrity-notice"><strong>Hash confirmado.</strong> O comprovante informado corresponde ao estado atual da blockchain.</div>`
          : `<div class="notice error integrity-notice"><strong>Hash divergente.</strong> O comprovante informado não corresponde ao estado atual da blockchain.</div>`;
    }

    resultHtml = `
      <div class="receipt-card integrity-result">
        <div class="receipt-head">
          <span class="status-dot ${isRegistered ? "ok" : ""}"></span>
          <strong>Comprovante encontrado</strong>
        </div>
        <p>A transação deste TXID está registrada no bloco <strong>${result.blockheight ?? "-"}</strong> com <strong>${confirmations}</strong> confirmação(ões).</p>
        ${hashStatusHtml}
      </div>
    `;
  }

  return `
    <article class="panel vote-integrity-panel">
      <div class="panel-title">
        <h2>Verificar voto</h2>
      </div>
      <label>
        TXID do comprovante
        <input id="auditSearchTxid" value="${escapeHtml(state.auditSearchTxid)}" ${state.busy ? "disabled" : ""} />
      </label>
      <label>
        Hash do comprovante
        <input id="auditSearchHash" value="${escapeHtml(state.auditSearchHash)}" ${state.busy ? "disabled" : ""} />
      </label>
      <div class="integrity-actions">
        <button id="searchAuditTxid" class="primary" ${!state.election || !state.auditSearchTxid || state.busy ? "disabled" : ""}>Verificar</button>
      </div>
      ${resultHtml}
    </article>
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
          CPF
          <input id="voteCpf" value="${escapeHtml(state.voteCpf)}" />
        </label>
        <label>
          PIN de Votação
          <input id="votePin" value="${escapeHtml(state.votePin)}" type="password" />
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
          <h2>${state.mode === "votifalho" ? "Protocolo" : "Comprovante"}</h2>
        </div>
        ${renderReceipt()}
      </article>
    </section>
    ${state.mode === "votify" ? `<section class="integrity-layout">${renderVoteIntegrityWidget()}</section>` : ""}
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
          <h2>Auditoria Geral</h2>
        </div>
        ${renderAuditSummary()}
        ${renderConsensusPanel()}
      </article>
    </section>
  `;
}

function renderChoiceOptions(selected: string) {
  return (state.election?.candidates ?? [])
    .map(
      (candidate) =>
        `<option value="${escapeHtml(candidate.number)}" ${
          selected === candidate.number ? "selected" : ""
        }>${escapeHtml(candidate.number)} - ${escapeHtml(candidate.name)}</option>`
    )
    .join("");
}

function renderAttackResult() {
  const result = state.attackResult;
  if (!result) return `<div class="empty-box"></div>`;

  const isBlocked = result.status === "blocked";

  return `
    <div class="attack-result ${isBlocked ? "blocked" : "accepted"}">
      <p>${escapeHtml(result.message)}</p>
    </div>
  `;
}

function renderNodeCommandResult() {
  const result = state.nodeCommandResult;
  if (!result) return "";

  const variant = result.status === "blocked" ? "blocked" : result.status === "accepted" ? "accepted" : "ok";
  const stdout = result.stdout?.trim();
  const stderr = result.stderr?.trim();
  const output = [
    stdout ? stdout : "",
    stderr ? `STDERR:\n${stderr}` : ""
  ]
    .filter(Boolean)
    .join("\n\n") || result.message;

  return `
    <div class="node-command-output ${variant}">
      <div class="node-command-meta">
        <span>exit ${result.exitCode ?? 0}</span>
      </div>
      <pre>${escapeHtml(output)}</pre>
    </div>
  `;
}

function renderAdminPage() {
  return `
    <div class="page-action">
      <a href="/" class="back-link">Voltar</a>
    </div>
    <section class="admin-layout">
      <article class="panel">
        <div class="panel-title">
          <h2>Alterar voto registrado</h2>
        </div>
        <div class="node-command">
          <div class="node-command-line">
            <span>nó$</span>
            <input
              id="nodeCommand"
              value="${escapeHtml(state.nodeCommand)}"
              placeholder="alterar-voto 1 2"
              ${state.busy ? "disabled" : ""}
            />
            <button id="executeNodeCommand" class="secondary" ${
              !state.election || state.busy ? "disabled" : ""
            }>Enviar</button>
          </div>
          ${renderNodeCommandResult()}
        </div>
      </article>

      ${
        state.mode === "votify"
          ? `<article class="panel admin-node-panel">
              <div class="panel-title">
                <h2>Controle de nós</h2>
              </div>
              ${renderConsensusPanel(true)}
            </article>`
          : `<article class="panel admin-node-panel">
              <div class="panel-title">
                <h2>Simulação de Ataque</h2>
              </div>
              <div class="node-actions" style="margin-top: 1rem; display: flex; gap: 1rem;">
                <button id="btnCompromiseDb" class="danger">Comprometer Banco</button>
                <button id="btnDropDb" class="danger">Derrubar Banco</button>
              </div>
            </article>`
      }

      <article class="panel admin-count">
        <div class="panel-title">
          <h2>Contagem atual</h2>
        </div>
        ${state.audit ? renderVoteResults() : `<div class="empty-box"></div>`}
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
  if (currentRoute === "admin") return renderAdminPage();
  return renderVotePage();
}

function bindCommonEvents() {
  const voteCpf = document.querySelector<HTMLInputElement>("#voteCpf");
  if (voteCpf) {
    voteCpf.oninput = (event) => {
      state.voteCpf = (event.target as HTMLInputElement).value;
    };
  }

  const votePin = document.querySelector<HTMLInputElement>("#votePin");
  if (votePin) {
    votePin.oninput = (event) => {
      state.votePin = (event.target as HTMLInputElement).value;
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

  const attackFromChoice = document.querySelector<HTMLSelectElement>("#attackFromChoice");
  if (attackFromChoice) {
    attackFromChoice.onchange = () => {
      state.attackFromChoice = attackFromChoice.value;
      if (state.attackToChoice === state.attackFromChoice) {
        normalizeAttackChoices();
      }
      state.attackResult = null;
      render();
    };
  }

  const attackToChoice = document.querySelector<HTMLSelectElement>("#attackToChoice");
  if (attackToChoice) {
    attackToChoice.onchange = () => {
      state.attackToChoice = attackToChoice.value;
      state.attackResult = null;
      render();
    };
  }

  const nodeCommand = document.querySelector<HTMLInputElement>("#nodeCommand");
  if (nodeCommand) {
    nodeCommand.oninput = () => {
      state.nodeCommand = nodeCommand.value;
      state.nodeCommandResult = null;
    };
    nodeCommand.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void executeNodeCommand();
      }
    };
  }

  const auditSearchTxid = document.querySelector<HTMLInputElement>("#auditSearchTxid");
  if (auditSearchTxid) {
    auditSearchTxid.oninput = () => {
      state.auditSearchTxid = auditSearchTxid.value;
      state.auditSearchResult = null;
      state.auditSearchError = "";
      render();
    };
  }

  const auditSearchHash = document.querySelector<HTMLInputElement>("#auditSearchHash");
  if (auditSearchHash) {
    auditSearchHash.oninput = () => {
      state.auditSearchHash = auditSearchHash.value;
      state.auditSearchResult = null;
      state.auditSearchError = "";
      render();
    };
  }

  const targetNode = document.querySelector<HTMLSelectElement>("#targetNode");
  if (targetNode) {
    targetNode.onchange = () => {
      state.targetNodeId = targetNode.value;
      render();
    };
  }

  document.querySelector<HTMLButtonElement>("#searchAuditTxid")?.addEventListener("click", () => void searchAuditTxid());


  document.querySelector<HTMLButtonElement>("#saveBallot")?.addEventListener("click", () => void saveBallot());
  document.querySelector<HTMLButtonElement>("#lockElection")?.addEventListener("click", () => void lockElection());
  document.querySelector<HTMLButtonElement>("#addCandidate")?.addEventListener("click", () => addCandidateDraft());
  document.querySelector<HTMLButtonElement>("#registerVoter")?.addEventListener("click", () => void registerVoter());
  document.querySelector<HTMLButtonElement>("#randomVoter")?.addEventListener("click", () => fillRandomVoter());
  document.querySelector<HTMLButtonElement>("#clearVoters")?.addEventListener("click", () => clearDemoVoters());
  document.querySelector<HTMLButtonElement>("#clearVote")?.addEventListener("click", () => clearVoteForm());
  document.querySelector<HTMLButtonElement>("#castVote")?.addEventListener("click", () => void castVote());
  document.querySelector<HTMLButtonElement>("#executeAttack")?.addEventListener("click", () => void executeChangeVoteAttack());
  document.querySelector<HTMLButtonElement>("#executeNodeCommand")?.addEventListener("click", () => void executeNodeCommand());
  document.querySelector<HTMLButtonElement>("#compromiseNode")?.addEventListener("click", () => void compromiseFiscalNode());
  document.querySelector<HTMLButtonElement>("#stopNode")?.addEventListener("click", () => void stopFiscalNode());
  document.querySelector<HTMLButtonElement>("#restoreNode")?.addEventListener("click", () => void restoreFiscalNode());
  document.querySelector<HTMLButtonElement>("#modeSwitch")?.addEventListener("click", (event) => {
    const nextMode = (event.currentTarget as HTMLButtonElement).dataset.nextMode;
    if (nextMode === "votify" || nextMode === "votifalho") {
      void switchMode(nextMode);
    }
  });

  document.querySelector<HTMLButtonElement>("#btnDropDb")?.addEventListener("click", () => {
    state.nodeCommand = "derrubar-banco";
    void executeNodeCommand();
  });

  document.querySelector<HTMLButtonElement>("#btnCompromiseDb")?.addEventListener("click", () => {
    void executeCompromiseCentralDb();
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

function connectSSE() {
  const source = new EventSource(`${API_BASE}/visual/events`);

  source.addEventListener("connected", () => {
    // Apenas log de conexão ou state update se necessário
  });

  source.addEventListener("visual_event", (message) => {
    const event = JSON.parse((message as MessageEvent).data);
    const refreshEvents = ["vote_cast", "voter_registration", "election_locked", "audit_recalculated", "vote_change_attempt", "ballot_saved"];
    
    if (event.type === "vote_confirmed" && state.receipt && state.txid) {
      state.receipt.status = "confirmed";
      state.receipt.confirmations = Math.max(1, state.receipt.confirmations ?? 1);
      render();
      void pollCurrentRoute();
    } else if (refreshEvents.includes(event.type)) {
      void pollCurrentRoute();
    }
  });

  source.addEventListener("heartbeat", () => {
    // Mantém a conexão viva
  });

  source.onerror = () => {
    // Lida com erros se houver, o navegador tenta reconectar sozinho
  };
}

document.title = state.mode === "votifalho" ? "Votifalho" : "Votify";
const initialFaviconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
if (initialFaviconLink) {
  initialFaviconLink.href = state.mode === "votifalho" ? faviconVotifalhoUrl : faviconVotifyUrl;
}

render();
void initialize();
connectSSE();
