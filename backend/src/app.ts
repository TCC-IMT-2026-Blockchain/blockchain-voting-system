import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { env } from "./config/env.js";
import { store } from "./data/store.js";
import { traditionalStore } from "./data/traditionalStore.js";
import { blockchain } from "./services/blockchainClient.js";
import { visualEvents, type VisualEventType, type VisualSystem } from "./services/visualEvents.js";
import { derivePublicKey, safePublicUser } from "./lib/crypto.js";
import { HttpError, errorResponse } from "./lib/errors.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "./http/auth.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const router = express.Router();
const traditionalRouter = express.Router();

function emitVisualEvent(type: VisualEventType, system: VisualSystem, metadata?: Record<string, string | number | boolean | null>) {
  visualEvents.publish({ type, system, metadata });
}

function visualErrorCode(error: unknown) {
  return error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
}

function now() {
  return new Date().toISOString();
}

function getElectionOrThrow(id: string) {
  const election = store.all().elections.find((item) => item.id === id);
  if (!election) {
    throw new HttpError(404, "ELECTION_NOT_FOUND", "Eleição não encontrada.");
  }
  return election;
}

function ensureElectionIsUnlocked(election: { governanceLockedAt?: string | null }) {
  if (election.governanceLockedAt) {
    throw new HttpError(
      409,
      "ELECTION_GOVERNANCE_LOCKED",
      "A eleição já foi travada e não pode mais ser configurada."
    );
  }
}

function getTraditionalElectionOrThrow(id: string) {
  const election = traditionalStore.all().elections.find((item) => item.id === id);
  if (!election) {
    throw new HttpError(404, "ELECTION_NOT_FOUND", "Eleição não encontrada.");
  }
  return election;
}

function fakeReceiptHash(txid: string, choice: string, createdAt: string) {
  return createHash("sha256").update(`${txid}|${choice}|${createdAt}`).digest("hex");
}

function countTraditionalVotes(electionId: string) {
  return traditionalStore
    .all()
    .votes.filter((vote) => vote.electionId === electionId)
    .reduce<Record<string, number>>((counts, vote) => {
      counts[vote.choice] = (counts[vote.choice] ?? 0) + 1;
      return counts;
    }, {});
}

function countDuplicatedTraditionalVotes(electionId: string) {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const vote of traditionalStore.all().votes.filter((item) => item.electionId === electionId)) {
    const key = vote.publicKey?.trim() || vote.privateKeySimulation?.trim();
    if (!key) continue;
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function buildTraditionalAudit(electionId: string) {
  const election = getTraditionalElectionOrThrow(electionId);
  const votes = traditionalStore.all().votes.filter((item) => item.electionId === election.id);
  const voters = traditionalStore.all().voters.filter((item) => item.electionId === election.id);

  return {
    chain: "banco-centralizado",
    chain_height: 0,
    election_id: election.chainElectionId,
    asset: null,
    burn_address: null,
    tokens_burned_by_vote_transactions: 0,
    votes_total: votes.length,
    votes_by_choice: countTraditionalVotes(election.id),
    credentials_issued: voters.length,
    votes_match_burned_tokens: false,
    min_vote_confirmations: 0,
    duplicate_votes: countDuplicatedTraditionalVotes(election.id),
    centralized_records: votes.length,
    personal_data_exposed: voters.length
  };
}

function validateChangeVotePayload(body: unknown) {
  const payload = body as { electionId?: unknown; fromChoice?: unknown; toChoice?: unknown };
  const electionId = typeof payload?.electionId === "string" ? payload.electionId : "";
  const fromChoice = typeof payload?.fromChoice === "string" ? payload.fromChoice : "";
  const toChoice = typeof payload?.toChoice === "string" ? payload.toChoice : "";

  if (!electionId || !fromChoice || !toChoice) {
    throw new HttpError(400, "ATTACK_INVALID_PAYLOAD", "Eleição, origem e destino do ataque são obrigatórios.");
  }

  if (fromChoice === toChoice) {
    throw new HttpError(400, "ATTACK_SAME_CHOICE", "A origem e o destino precisam ser diferentes.");
  }

  return { electionId, fromChoice, toChoice };
}

function validateChoiceExists(election: { candidates: { number: string }[] }, choice: string) {
  if (!election.candidates.some((candidate) => candidate.number === choice)) {
    throw new HttpError(400, "ATTACK_CHOICE_NOT_FOUND", "A opção informada não existe nesta eleição.");
  }
}

function getTraditionalVoterForPrivateKey(electionId: string, privateKeySimulation: unknown) {
  if (typeof privateKeySimulation !== "string" || !privateKeySimulation.trim()) {
    throw new HttpError(400, "PRIVATE_KEY_REQUIRED", "A chave privada é obrigatória.");
  }

  const normalizedPrivateKey = privateKeySimulation.trim();
  const publicKey = derivePublicKey(normalizedPrivateKey);
  const voter = traditionalStore
    .all()
    .voters.find((item) => item.electionId === electionId && item.publicKey === publicKey);

  if (!voter) {
    throw new HttpError(404, "VOTER_NOT_REGISTERED", "Eleitor não cadastrado para esta eleição.");
  }

  return { voter, publicKey, privateKeySimulation: normalizedPrivateKey };
}

function parseNodeCommandPayload(body: unknown) {
  const payload = body as { electionId?: unknown; command?: unknown };
  const electionId = typeof payload?.electionId === "string" ? payload.electionId : "";
  const command = typeof payload?.command === "string" ? payload.command.trim() : "";

  if (!electionId || !command) {
    throw new HttpError(400, "NODE_COMMAND_INVALID_PAYLOAD", "Eleição e comando são obrigatórios.");
  }

  return { electionId, command };
}

function parseNodeCommand(command: string) {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  const action = parts[0]?.toLowerCase();

  if (action === "ajuda" || action === "help") {
    return { type: "help" as const };
  }

  if (action === "status") {
    return { type: "status" as const };
  }

  if (action === "alterar-voto" || action === "alterar" || action === "mudar-voto") {
    const fromChoice = parts[1] ?? "";
    const toChoice = parts[2] ?? "";
    if (!fromChoice || !toChoice || parts.length !== 3) {
      throw new HttpError(400, "NODE_COMMAND_INVALID_CHANGE_VOTE", "Use: alterar-voto <origem> <destino>.");
    }
    return { type: "change_vote" as const, fromChoice, toChoice };
  }

  throw new HttpError(
    400,
    "NODE_COMMAND_NOT_SUPPORTED",
    "Comando não reconhecido. Use: status ou alterar-voto <origem> <destino>."
  );
}

function quotePowerShell(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function apiBaseForMode(mode: "votify" | "votifalho") {
  const base = `http://127.0.0.1:${env.port}${env.apiPrefix}`;
  return mode === "votifalho" ? `${base}/traditional` : base;
}

function buildWindowsTerminalScript(mode: "votify" | "votifalho", electionId: string, command: string) {
  const changeVoteUrl = `${apiBaseForMode(mode)}/maintenance/change-vote`;
  const label = mode === "votifalho" ? "Votifalho" : "Votify";

  return `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
function alterar-voto {
  param([string]$origem, [string]$destino)
  if (-not $origem -or -not $destino) {
    Write-Error 'Use: alterar-voto <origem> <destino>'
    exit 2
  }
  $body = @{ electionId = ${quotePowerShell(electionId)}; fromChoice = $origem; toChoice = $destino } | ConvertTo-Json -Compress
  try {
    $response = Invoke-RestMethod -Uri ${quotePowerShell(changeVoteUrl)} -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
    if ($response.data.status -eq 'blocked') {
      if ($response.data.reason) { [Console]::Error.WriteLine($response.data.reason) } else { [Console]::Error.WriteLine("ERRO: $($response.data.message)") }
      exit 1
    }
    if ($response.data.message) { $response.data.message } else { $response | ConvertTo-Json -Depth 16 }
  } catch {
    if ($_.ErrorDetails.Message) { [Console]::Error.WriteLine("ERRO: $($_.ErrorDetails.Message)") } else { [Console]::Error.WriteLine("ERRO: $($_.Exception.Message)") }
    exit 1
  }
}
function status {
  Write-Output ${quotePowerShell(`Terminal conectado ao ${label}.`)}
}
function ajuda {
  Write-Output 'Comandos auxiliares: alterar-voto <origem> <destino>, status, ajuda. Outros comandos do PowerShell tambem sao executados.'
}
${command}
`;
}

function buildUnixTerminalScript(mode: "votify" | "votifalho", electionId: string, command: string) {
  const changeVoteUrl = `${apiBaseForMode(mode)}/maintenance/change-vote`;
  const label = mode === "votifalho" ? "Votifalho" : "Votify";

  return `
alterar-voto() {
  if [ -z "$1" ] || [ -z "$2" ]; then
    echo 'Use: alterar-voto <origem> <destino>' >&2
    return 2
  fi
  curl -sS -X POST ${quoteShell(changeVoteUrl)} \\
    -H 'Content-Type: application/json' \\
    --data '{"electionId":${JSON.stringify(electionId)},"fromChoice":"'"$1"'","toChoice":"'"$2"'"}'
}
status() {
  echo ${quoteShell(`Terminal conectado ao ${label}.`)}
}
ajuda() {
  echo 'Comandos auxiliares: alterar-voto <origem> <destino>, status, ajuda. Outros comandos do shell tambem sao executados.'
}
${command}
`;
}

function statusFromTerminal(stdout: string, exitCode: number): "accepted" | "blocked" | "ok" {
  try {
    const parsed = JSON.parse(stdout.trim()) as { data?: { status?: unknown } };
    if (parsed.data?.status === "accepted") return "accepted";
    if (parsed.data?.status === "blocked") return "blocked";
  } catch {
    // Plain terminal commands do not need JSON output.
  }

  if (/n.o permitiu|blockchain.*permitiu|bloquead/i.test(stdout)) return "blocked";
  if (/alterou|centralizado/i.test(stdout)) return "accepted";

  return exitCode === 0 ? "ok" : "blocked";
}

function messageFromTerminal(stdout: string, fallback: string) {
  try {
    const parsed = JSON.parse(stdout.trim()) as { data?: { message?: unknown } };
    if (typeof parsed.data?.message === "string") return parsed.data.message;
  } catch {
    // Plain terminal commands use stdout/stderr directly.
  }

  return fallback;
}

function runTerminalCommand(mode: "votify" | "votifalho", electionId: string, command: string) {
  const isWindows = process.platform === "win32";
  const file = isWindows ? "powershell.exe" : "/bin/sh";
  const script = isWindows
    ? buildWindowsTerminalScript(mode, electionId, command)
    : buildUnixTerminalScript(mode, electionId, command);
  const args = isWindows
    ? ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]
    : ["-lc", script];

  return new Promise<{
    system: "votify" | "votifalho";
    command: string;
    status: "accepted" | "blocked" | "ok";
    message: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  }>((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: process.cwd(),
        timeout: 30000,
        maxBuffer: 200_000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const code = (error as { code?: unknown } | null)?.code;
        const exitCode = typeof code === "number" ? code : error ? 1 : 0;
        const status = statusFromTerminal(stdout, exitCode);
        resolve({
          system: mode,
          command,
          status,
          message: messageFromTerminal(stdout, exitCode === 0 ? "Comando executado." : "Comando finalizado com erro."),
          stdout,
          stderr,
          exitCode
        });
      }
    );
  });
}

function routeParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_ROUTE_PARAM", `O parâmetro ${name} deve ser um texto.`);
  }
  return value;
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: now(), version: "0.1.0" });
});

router.get("/visual/events", (_req, res) => {
  visualEvents.subscribe(res);
});

router.post("/auth/login", (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const user = store.all().users.find((item) => item.email === email && item.password === password);
    if (!user) {
      throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    }

    res.json({
      data: {
        accessToken: user.token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: safePublicUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ data: safePublicUser(req.user!) });
});

traditionalRouter.post("/auth/login", (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const user = store.all().users.find((item) => item.email === email && item.password === password);
    if (!user) {
      throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    }

    res.json({
      data: {
        accessToken: user.token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: safePublicUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
});

traditionalRouter.post("/crypto/public-key", (req, res) => {
  const { privateKeySimulation } = req.body ?? {};
  if (!privateKeySimulation) {
    throw new HttpError(400, "PRIVATE_KEY_REQUIRED", "A chave privada é obrigatória.");
  }
  res.json({ data: { publicKey: derivePublicKey(privateKeySimulation) } });
});

traditionalRouter.get("/elections", requireAuth, (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const elections = status
    ? traditionalStore.all().elections.filter((item) => item.status === status)
    : traditionalStore.all().elections;

  res.json({ data: elections, meta: { total: elections.length } });
});

traditionalRouter.get("/elections/:electionId", requireAuth, (req, res, next) => {
  try {
    res.json({ data: getTraditionalElectionOrThrow(routeParam(req.params.electionId, "electionId")) });
  } catch (error) {
    next(error);
  }
});

traditionalRouter.put(
  "/admin/elections/:electionId/ballot",
  requireAuth,
  requireRole("ADMIN"),
  (req, res, next) => {
    try {
      const election = getTraditionalElectionOrThrow(routeParam(req.params.electionId, "electionId"));
      const { title, candidates } = req.body ?? {};

      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedTitle || !Array.isArray(candidates)) {
        throw new HttpError(400, "BALLOT_INVALID_PAYLOAD", "Título e lista de opções são obrigatórios.");
      }

      const normalizedCandidates = candidates.map((candidate) => {
        const name = typeof candidate?.name === "string" ? candidate.name.trim() : "";
        const number = typeof candidate?.number === "string" ? candidate.number.trim() : "";

        if (!name || !number) {
          throw new HttpError(400, "BALLOT_INVALID_OPTION", "Cada opção precisa ter nome e código.");
        }

        return {
          id: typeof candidate?.id === "string" && candidate.id ? candidate.id : randomUUID(),
          electionId: election.id,
          name,
          number,
          description: typeof candidate?.description === "string" ? candidate.description : null
        };
      });

      election.title = normalizedTitle;
      election.candidates = normalizedCandidates;
      election.updatedAt = now();
      traditionalStore.save();
      emitVisualEvent("ballot_saved", "votifalho", {
        options: normalizedCandidates.length
      });

      res.json({ data: election });
    } catch (error) {
      next(error);
    }
  }
);

traditionalRouter.post(
  "/admin/elections/:electionId/voters",
  requireAuth,
  requireRole("ADMIN"),
  (req, res, next) => {
    try {
      const election = getTraditionalElectionOrThrow(routeParam(req.params.electionId, "electionId"));
      const { cpf, publicKey } = req.body ?? {};
      if (!cpf || !publicKey) {
        throw new HttpError(400, "VOTER_INVALID_PAYLOAD", "CPF e chave pública são obrigatórios.");
      }

      const voter = {
        id: randomUUID(),
        electionId: election.id,
        cpf,
        publicKey,
        createdAt: now()
      };

      traditionalStore.all().voters.push(voter);
      traditionalStore.save();
      emitVisualEvent("voter_registration", "votifalho");

      res.status(201).json({
        data: {
          id: voter.id,
          electionId: election.id,
          cpf: voter.cpf,
          publicKey: voter.publicKey
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

traditionalRouter.post("/elections/:electionId/votes", requireAuth, (req, res, next) => {
  try {
    const election = getTraditionalElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const { choice, privateKeySimulation } = req.body ?? {};

    if (!choice) {
      throw new HttpError(400, "VOTE_INVALID_PAYLOAD", "Escolha do voto é obrigatória.");
    }

    if (election.candidates.length === 0) {
      throw new HttpError(400, "BALLOT_NOT_CONFIGURED", "A eleição ainda não possui opções de voto cadastradas.");
    }

    if (!election.candidates.some((candidate) => candidate.number === choice)) {
      throw new HttpError(400, "VOTE_CHOICE_NOT_FOUND", "A opção de voto selecionada não existe nesta eleição.");
    }

    const voterProof = getTraditionalVoterForPrivateKey(election.id, privateKeySimulation);
    const alreadyVoted = traditionalStore
      .all()
      .votes.some(
        (vote) =>
          vote.electionId === election.id &&
          (vote.voterId === voterProof.voter.id ||
            vote.publicKey === voterProof.publicKey ||
            vote.privateKeySimulation === voterProof.privateKeySimulation)
      );

    if (alreadyVoted) {
      throw new HttpError(409, "VOTE_ALREADY_CAST", "O eleitor não pode votar duas vezes.");
    }

    const createdAt = now();
    const txid = randomUUID().replace(/-/g, "");
    const receiptHash = fakeReceiptHash(txid, String(choice), createdAt);
    const vote = {
      id: randomUUID(),
      electionId: election.id,
      choice: String(choice),
      voterId: voterProof.voter.id,
      publicKey: voterProof.publicKey,
      privateKeySimulation: voterProof.privateKeySimulation,
      txid,
      receiptHash,
      createdAt
    };

    traditionalStore.all().votes.push(vote);
    traditionalStore.save();
    emitVisualEvent("vote_cast", "votifalho");

    res.status(201).json({
      data: {
        status: "vote_sent",
        txid,
        receipt: {
          txid,
          status: "registered",
          blockheight: null,
          confirmations: 0,
          receipt_hash: receiptHash
        }
      }
    });
  } catch (error) {
    emitVisualEvent("vote_rejected", "votifalho", {
      reason: visualErrorCode(error)
    });
    next(error);
  }
});

traditionalRouter.get("/elections/:electionId/votes/:txid/receipt", requireAuth, (req, res, next) => {
  try {
    const election = getTraditionalElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const txid = routeParam(req.params.txid, "txid");
    const vote = traditionalStore.all().votes.find((item) => item.electionId === election.id && item.txid === txid);
    if (!vote) {
      throw new HttpError(404, "RECEIPT_NOT_FOUND", "Comprovante não encontrado.");
    }

    res.json({
      data: {
        txid: vote.txid,
        status: "registered",
        blockheight: null,
        confirmations: 0,
        receipt_hash: vote.receiptHash
      }
    });
  } catch (error) {
    next(error);
  }
});

traditionalRouter.get(
  "/elections/:electionId/audit",
  requireAuth,
  requireRole("ADMIN", "AUDITOR"),
  (req, res, next) => {
    try {
      res.json({ data: buildTraditionalAudit(routeParam(req.params.electionId, "electionId")) });
    } catch (error) {
      next(error);
    }
  }
);

traditionalRouter.post("/maintenance/change-vote", (req, res, next) => {
  try {
    const { electionId, fromChoice, toChoice } = validateChangeVotePayload(req.body);
    const election = getTraditionalElectionOrThrow(electionId);
    validateChoiceExists(election, fromChoice);
    validateChoiceExists(election, toChoice);

    const before = buildTraditionalAudit(election.id);
    const vote = traditionalStore
      .all()
      .votes.find((item) => item.electionId === election.id && item.choice === fromChoice);

    if (!vote) {
      throw new HttpError(404, "ATTACK_TARGET_NOT_FOUND", "Nenhum voto de origem foi encontrado para alterar.");
    }

    vote.choice = toChoice;
    vote.receiptHash = fakeReceiptHash(vote.txid, vote.choice, vote.createdAt);
    traditionalStore.save();
    emitVisualEvent("vote_change_attempt", "votifalho", {
      accepted: true
    });

    res.json({
      data: {
        system: "votifalho",
        attack: "change_vote",
        status: "accepted",
        message: "O voto foi alterado diretamente no banco centralizado.",
        modifiedTxid: vote.txid,
        before,
        after: buildTraditionalAudit(election.id)
      }
    });
  } catch (error) {
    next(error);
  }
});

traditionalRouter.post("/maintenance/node-command", async (req, res, next) => {
  try {
    const { electionId, command } = parseNodeCommandPayload(req.body);
    if (command || !command) {
      getTraditionalElectionOrThrow(electionId);
      res.json({ data: await runTerminalCommand("votifalho", electionId, command) });
      return;
    }
    const parsed = parseNodeCommand(command);
    const election = getTraditionalElectionOrThrow(electionId);

    if (parsed.type === "help") {
      res.json({
        data: {
          system: "votifalho",
          command,
          status: "ok",
          message: "Comandos disponíveis: status, alterar-voto <origem> <destino>."
        }
      });
      return;
    }

    if (parsed.type === "status") {
      const audit = buildTraditionalAudit(election.id);
      res.json({
        data: {
          system: "votifalho",
          command,
          status: "ok",
          message: `Banco centralizado respondeu com ${audit.votes_total} voto(s) registrado(s).`,
          audit
        }
      });
      return;
    }

    validateChoiceExists(election, parsed.fromChoice);
    validateChoiceExists(election, parsed.toChoice);

    const before = buildTraditionalAudit(election.id);
    const vote = traditionalStore
      .all()
      .votes.find((item) => item.electionId === election.id && item.choice === parsed.fromChoice);

    if (!vote) {
      throw new HttpError(404, "NODE_COMMAND_TARGET_NOT_FOUND", "Nenhum voto de origem foi encontrado para alterar.");
    }

    vote.choice = parsed.toChoice;
    vote.receiptHash = fakeReceiptHash(vote.txid, vote.choice, vote.createdAt);
    traditionalStore.save();

    res.json({
      data: {
        system: "votifalho",
        command,
        status: "accepted",
        message: "O comando alterou o voto diretamente no banco centralizado.",
        before,
        after: buildTraditionalAudit(election.id)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/crypto/public-key", (req, res) => {
  const { privateKeySimulation } = req.body ?? {};
  if (!privateKeySimulation) {
    throw new HttpError(400, "PRIVATE_KEY_REQUIRED", "A chave privada é obrigatória.");
  }
  res.json({ data: { publicKey: derivePublicKey(privateKeySimulation) } });
});

router.get("/elections", requireAuth, (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const elections = status
    ? store.all().elections.filter((item) => item.status === status)
    : store.all().elections;

  res.json({ data: elections, meta: { total: elections.length } });
});

router.get("/elections/:electionId", requireAuth, (req, res, next) => {
  try {
    res.json({ data: getElectionOrThrow(routeParam(req.params.electionId, "electionId")) });
  } catch (error) {
    next(error);
  }
});

router.get("/elections/:electionId/ballot", requireAuth, (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    res.json({
      data: {
        electionId: election.id,
        title: election.title,
        status: election.status,
        candidates: election.candidates
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/elections", requireAuth, requireRole("ADMIN"), (req, res, next) => {
  try {
    const { title, description, startsAt, endsAt, chainElectionId } = req.body ?? {};
    if (!title || !description || !startsAt || !endsAt) {
      throw new HttpError(400, "ELECTION_INVALID_PAYLOAD", "Campos obrigatórios da eleição não foram informados.");
    }

    const election = {
      id: randomUUID(),
      chainElectionId: chainElectionId ?? env.defaultChainElectionId,
      title,
      description,
      status: "DRAFT" as const,
      startsAt,
      endsAt,
      candidates: [],
      createdAt: now(),
      updatedAt: now()
    };

    store.all().elections.push(election);
    store.save();
    res.status(201).json({ data: election });
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/elections/:electionId", requireAuth, requireRole("ADMIN"), (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const { title, description, status, startsAt, endsAt } = req.body ?? {};
    if (title) election.title = title;
    if (description) election.description = description;
    if (status) election.status = status;
    if (startsAt) election.startsAt = startsAt;
    if (endsAt) election.endsAt = endsAt;
    election.updatedAt = now();
    store.save();
    res.json({ data: election });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/elections/:electionId/ballot", requireAuth, requireRole("ADMIN"), (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    ensureElectionIsUnlocked(election);
    const { title, candidates } = req.body ?? {};

    if (store.all().receipts.some((receipt) => receipt.electionId === election.id)) {
      throw new HttpError(
        409,
        "BALLOT_ALREADY_HAS_VOTES",
        "A eleição não pode ser alterada depois que já recebeu votos."
      );
    }

    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    if (!normalizedTitle || !Array.isArray(candidates)) {
      throw new HttpError(400, "BALLOT_INVALID_PAYLOAD", "Título e lista de opções são obrigatórios.");
    }

    const normalizedCandidates = candidates.map((candidate, index) => {
      const name = typeof candidate?.name === "string" ? candidate.name.trim() : "";
      const number = typeof candidate?.number === "string" ? candidate.number.trim() : "";

      if (!name || !number) {
        throw new HttpError(400, "BALLOT_INVALID_OPTION", "Cada opção precisa ter nome e código.");
      }

      return {
        id: typeof candidate?.id === "string" && candidate.id ? candidate.id : randomUUID(),
        electionId: election.id,
        name,
        number,
        description: typeof candidate?.description === "string" ? candidate.description : null
      };
    });

    const duplicatedNumber = normalizedCandidates.find(
      (candidate, index) => normalizedCandidates.findIndex((item) => item.number === candidate.number) !== index
    );
    if (duplicatedNumber) {
      throw new HttpError(400, "BALLOT_DUPLICATED_OPTION", "Os códigos das opções não podem se repetir.");
    }

    election.title = normalizedTitle;
    election.candidates = normalizedCandidates;
    election.updatedAt = now();
    store.save();
    emitVisualEvent("ballot_saved", "votify", {
      options: normalizedCandidates.length
    });

    res.json({ data: election });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/elections/:electionId/candidates", requireAuth, requireRole("ADMIN"), (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    ensureElectionIsUnlocked(election);
    const { name, number, description } = req.body ?? {};
    if (!name || !number) {
      throw new HttpError(400, "CANDIDATE_INVALID_PAYLOAD", "Nome e número da opção são obrigatórios.");
    }

    const candidate = {
      id: randomUUID(),
      electionId: election.id,
      name,
      number,
      description: description ?? null
    };

    election.candidates.push(candidate);
    election.updatedAt = now();
    store.save();
    res.status(201).json({ data: candidate });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/elections/:electionId/voters", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    ensureElectionIsUnlocked(election);
    const { cpf, publicKey } = req.body ?? {};
    if (!cpf || !publicKey) {
      throw new HttpError(400, "VOTER_INVALID_PAYLOAD", "CPF e chave pública são obrigatórios.");
    }

    const voterIdHash = await blockchain.hashCpf(cpf, election.chainElectionId);
    if (store.all().voters.some((item) => item.electionId === election.id && item.voterIdHash === voterIdHash)) {
      throw new HttpError(409, "VOTER_ALREADY_REGISTERED", "Eleitor já cadastrado para esta eleição.");
    }

    const chainResult = await blockchain.registerVoter(election.chainElectionId, voterIdHash, publicKey);
    const voter = {
      id: randomUUID(),
      electionId: election.id,
      voterIdHash,
      publicKey,
      identityTxid: chainResult.identity_txid,
      createdAt: now()
    };

    store.all().voters.push(voter);
    store.save();
    emitVisualEvent("voter_registration", "votify");
    res.status(201).json({
      data: {
        id: voter.id,
        electionId: election.id,
        identityTxid: voter.identityTxid,
        voterIdHash
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/elections/:electionId/lock", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  let failureWasPublished = false;

  function publishLockFailure(reason: string) {
    if (failureWasPublished) return;
    failureWasPublished = true;
    emitVisualEvent("election_lock_rejected", "votify", { reason });
  }

  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    if (election.governanceLockedAt) {
      emitVisualEvent("election_locked", "votify", {
        alreadyLocked: true
      });
      res.json({
        data: {
          election,
          issuedCredentials: [],
          governance: election.governanceLockResult ?? null
        }
      });
      return;
    }

    if (election.candidates.length === 0) {
      publishLockFailure("missing_options");
      throw new HttpError(400, "BALLOT_NOT_CONFIGURED", "Cadastre as opções de voto antes de travar a eleição.");
    }

    const voters = store.all().voters.filter((item) => item.electionId === election.id);
    if (voters.length === 0) {
      publishLockFailure("missing_voters");
      throw new HttpError(400, "VOTERS_NOT_CONFIGURED", "Cadastre pelo menos um eleitor antes de travar a eleição.");
    }

    const issuedCredentials = [];
    for (const voter of voters) {
      if (voter.voterAddress) continue;

      const credential = await blockchain.issueCredential(election.chainElectionId, voter.voterIdHash);
      voter.credentialRecordTxid = credential.credential_record_txid;
      voter.voterAddress = credential.voter_address;
      voter.tokenTransferTxid = credential.token_transfer_txid;
      issuedCredentials.push({
        voterIdHash: voter.voterIdHash,
        voterAddress: credential.voter_address,
        tokenTransferTxid: credential.token_transfer_txid,
        credentialRecordTxid: credential.credential_record_txid
      });
    }

    const governance = await blockchain.lockGovernance();
    election.governanceLockedAt = now();
    election.governanceLockResult = governance;
    election.updatedAt = now();
    store.save();
    emitVisualEvent("election_locked", "votify", {
      credentials: issuedCredentials.length,
      voters: voters.length
    });

    res.json({
      data: {
        election,
        issuedCredentials,
        governance
      }
    });
  } catch (error) {
    publishLockFailure("lock_failed");
    next(error);
  }
});

router.post("/elections/:electionId/credentials", requireAuth, async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const { cpf, privateKeySimulation } = req.body ?? {};
    if (!cpf || !privateKeySimulation) {
      throw new HttpError(400, "CREDENTIAL_INVALID_PAYLOAD", "CPF e chave privada são obrigatórios.");
    }

    const voterIdHash = await blockchain.hashCpf(cpf, election.chainElectionId);
    const voter = store.all().voters.find((item) => item.electionId === election.id && item.voterIdHash === voterIdHash);
    if (!voter) {
      throw new HttpError(404, "VOTER_NOT_REGISTERED", "Eleitor não cadastrado para esta eleição.");
    }

    const publicKey = derivePublicKey(privateKeySimulation);
    if (publicKey !== voter.publicKey) {
      throw new HttpError(403, "PRIVATE_KEY_INVALID", "A chave privada não corresponde à chave pública cadastrada.");
    }

    if (!voter.voterAddress) {
      throw new HttpError(
        409,
        "CREDENTIAL_NOT_ISSUED",
        "A credencial ainda não foi emitida. O administrador precisa travar a eleição antes da votação."
      );
    }

    res.json({
      data: {
        status: "credential_available",
        voterAddress: voter.voterAddress,
        tokenTransferTxid: voter.tokenTransferTxid,
        credentialRecordTxid: voter.credentialRecordTxid
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/elections/:electionId/votes", requireAuth, async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    if (election.status !== "OPEN") {
      throw new HttpError(400, "ELECTION_NOT_OPEN", "A eleição não está aberta para votação.");
    }

    if (!election.governanceLockedAt) {
      throw new HttpError(
        409,
        "ELECTION_NOT_LOCKED",
        "A eleição precisa ser travada antes da votação."
      );
    }

    const { choice, privateKeySimulation } = req.body ?? {};
    if (!choice) {
      throw new HttpError(400, "VOTE_INVALID_PAYLOAD", "Escolha do voto é obrigatória.");
    }

    if (election.candidates.length === 0) {
      throw new HttpError(400, "BALLOT_NOT_CONFIGURED", "A eleição ainda não possui opções de voto cadastradas.");
    }

    if (!election.candidates.some((candidate) => candidate.number === choice)) {
      throw new HttpError(400, "VOTE_CHOICE_NOT_FOUND", "A opção de voto selecionada não existe nesta eleição.");
    }

    if (!privateKeySimulation) {
      throw new HttpError(400, "VOTE_INVALID_PAYLOAD", "Chave privada é obrigatória.");
    }

    const publicKey = derivePublicKey(privateKeySimulation);
    const voter = store.all().voters.find((item) => item.electionId === election.id && item.publicKey === publicKey);
    if (!voter) {
      throw new HttpError(404, "VOTER_NOT_REGISTERED", "Eleitor não cadastrado para esta eleição.");
    }

    if (!voter.voterAddress) {
      throw new HttpError(
        409,
        "CREDENTIAL_NOT_ISSUED",
        "A credencial deste eleitor ainda não foi emitida."
      );
    }

    const addressForVote = voter.voterAddress;
    const result = await blockchain.castVote(election.chainElectionId, choice, addressForVote);
    const receipt = {
      id: randomUUID(),
      electionId: election.id,
      txid: result.txid,
      choice,
      voterAddress: addressForVote,
      receiptHash: null,
      status: "PENDING",
      blockheight: null,
      confirmations: null,
      createdAt: now()
    };

    store.all().receipts.push(receipt);
    store.save();
    emitVisualEvent("vote_cast", "votify");

    res.status(201).json({
      data: {
        status: "vote_sent",
        txid: result.txid,
        voterAddress: addressForVote,
        credential: null,
        burnAddress: result.burn_address,
        receipt: result.receipt
      }
    });
  } catch (error) {
    emitVisualEvent("vote_rejected", "votify", {
      reason: visualErrorCode(error)
    });
    next(error);
  }
});

router.get("/elections/:electionId/votes/:txid/receipt", requireAuth, async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const receipt = await blockchain.receipt(election.chainElectionId, routeParam(req.params.txid, "txid"));
    if (req.query.visual === "1") {
      emitVisualEvent("receipt_verified", "votify");
    }
    res.json({ data: receipt });
  } catch (error) {
    next(error);
  }
});

router.get("/elections/:electionId/audit", requireAuth, requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const audit = await blockchain.audit(election.chainElectionId);
    if (req.query.visual === "1") {
      emitVisualEvent("audit_recalculated", "votify");
    }
    res.json({ data: audit });
  } catch (error) {
    next(error);
  }
});

router.post("/maintenance/change-vote", async (req, res, next) => {
  try {
    const { electionId, fromChoice, toChoice } = validateChangeVotePayload(req.body);
    const election = getElectionOrThrow(electionId);
    validateChoiceExists(election, fromChoice);
    validateChoiceExists(election, toChoice);

    const before = await blockchain.audit(election.chainElectionId);
    const targetReceipt = store
      .all()
      .receipts.find(
        (receipt) => receipt.electionId === election.id && receipt.choice === fromChoice && receipt.voterAddress
      );

    if (!targetReceipt?.voterAddress) {
      throw new HttpError(
        404,
        "ATTACK_TARGET_NOT_FOUND",
        "Nenhum voto de origem rastreável foi encontrado para tentar alterar."
      );
    }

    try {
      const forgedVote = await blockchain.castVote(election.chainElectionId, toChoice, targetReceipt.voterAddress);
      const after = await blockchain.audit(election.chainElectionId);

      res.json({
        data: {
          system: "votify",
          attack: "change_vote",
          status: "accepted",
          message: "A tentativa criou uma nova transação. Verifique a auditoria da blockchain.",
          targetTxid: targetReceipt.txid,
          forgedTxid: forgedVote.txid,
          before,
          after
        }
      });
    } catch (error) {
    const after = await blockchain.audit(election.chainElectionId);
    emitVisualEvent("vote_change_attempt", "votify", {
      accepted: false
    });
    res.json({
      data: {
          system: "votify",
          attack: "change_vote",
          status: "blocked",
          message: "A blockchain não permitiu alterar o voto confirmado.",
          targetTxid: targetReceipt.txid,
          reason:
            error instanceof HttpError && typeof error.details === "string"
              ? error.details
              : error instanceof Error
                ? error.message
                : "Tentativa rejeitada pela blockchain.",
          before,
          after
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/maintenance/node-command", async (req, res, next) => {
  try {
    const { electionId, command } = parseNodeCommandPayload(req.body);
    if (command || !command) {
      getElectionOrThrow(electionId);
      res.json({ data: await runTerminalCommand("votify", electionId, command) });
      return;
    }
    const parsed = parseNodeCommand(command);
    const election = getElectionOrThrow(electionId);

    if (parsed.type === "help") {
      res.json({
        data: {
          system: "votify",
          command,
          status: "ok",
          message: "Comandos disponíveis: status, alterar-voto <origem> <destino>."
        }
      });
      return;
    }

    if (parsed.type === "status") {
      const audit = (await blockchain.audit(election.chainElectionId)) as {
        chain_height?: number;
        votes_total?: number;
      };
      res.json({
        data: {
          system: "votify",
          command,
          status: "ok",
          message: `Nó respondeu com ${audit.chain_height ?? 0} bloco(s) e ${audit.votes_total ?? 0} voto(s).`,
          audit
        }
      });
      return;
    }

    validateChoiceExists(election, parsed.fromChoice);
    validateChoiceExists(election, parsed.toChoice);

    const before = await blockchain.audit(election.chainElectionId);
    const targetReceipt = store
      .all()
      .receipts.find(
        (receipt) => receipt.electionId === election.id && receipt.choice === parsed.fromChoice && receipt.voterAddress
      );

    if (!targetReceipt?.voterAddress) {
      throw new HttpError(
        404,
        "NODE_COMMAND_TARGET_NOT_FOUND",
        "Nenhum voto de origem rastreável foi encontrado para tentar alterar."
      );
    }

    try {
      await blockchain.castVote(election.chainElectionId, parsed.toChoice, targetReceipt.voterAddress);
      const after = await blockchain.audit(election.chainElectionId);
      res.json({
        data: {
          system: "votify",
          command,
          status: "accepted",
          message: "O comando criou uma nova transação. Verifique a auditoria da blockchain.",
          before,
          after
        }
      });
    } catch {
      const after = await blockchain.audit(election.chainElectionId);
      res.json({
        data: {
          system: "votify",
          command,
          status: "blocked",
          message: "O nó recebeu o comando, mas a blockchain não permitiu alterar o voto confirmado.",
          before,
          after
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

traditionalRouter.get("/blockchain/status", requireAuth, requireRole("ADMIN", "AUDITOR"), (_req, res) => {
  res.json({
    data: {
      chain: "banco-centralizado",
      blocks: 0,
      peers: 0,
      mode: "traditional"
    }
  });
});

router.get("/blockchain/status", requireAuth, requireRole("ADMIN", "AUDITOR"), async (_req, res, next) => {
  try {
    res.json({ data: await blockchain.status() });
  } catch (error) {
    next(error);
  }
});

router.use("/traditional", traditionalRouter);

app.use(env.apiPrefix, router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  errorResponse(res, error);
});

