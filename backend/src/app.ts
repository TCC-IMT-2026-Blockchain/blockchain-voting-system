import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createHash, randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { store } from "./data/store.js";
import { traditionalStore } from "./data/traditionalStore.js";
import { blockchain } from "./services/blockchainClient.js";
import { derivePublicKey, safePublicUser } from "./lib/crypto.js";
import { HttpError, errorResponse } from "./lib/errors.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "./http/auth.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const router = express.Router();
const traditionalRouter = express.Router();

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
    const key = vote.privateKeySimulation?.trim();
    if (!key) continue;
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
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

    const createdAt = now();
    const txid = randomUUID().replace(/-/g, "");
    const receiptHash = fakeReceiptHash(txid, String(choice), createdAt);
    const vote = {
      id: randomUUID(),
      electionId: election.id,
      choice: String(choice),
      privateKeySimulation: typeof privateKeySimulation === "string" ? privateKeySimulation : null,
      txid,
      receiptHash,
      createdAt
    };

    traditionalStore.all().votes.push(vote);
    traditionalStore.save();

    res.status(201).json({
      data: {
        status: "vote_sent",
        txid,
        receipt: {
          txid,
          status: "confirmed",
          blockheight: null,
          confirmations: 0,
          receipt_hash: receiptHash
        }
      }
    });
  } catch (error) {
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
        status: "confirmed",
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
      const election = getTraditionalElectionOrThrow(routeParam(req.params.electionId, "electionId"));
      const votes = traditionalStore.all().votes.filter((item) => item.electionId === election.id);
      const voters = traditionalStore.all().voters.filter((item) => item.electionId === election.id);

      res.json({
        data: {
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
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

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

    res.json({ data: election });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/elections/:electionId/candidates", requireAuth, requireRole("ADMIN"), (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
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

    const credential = await blockchain.issueCredential(election.chainElectionId, voterIdHash);
    voter.credentialRecordTxid = credential.credential_record_txid;
    voter.voterAddress = credential.voter_address;
    voter.tokenTransferTxid = credential.token_transfer_txid;
    store.save();

    res.status(201).json({
      data: {
        status: "credential_issued",
        voterAddress: credential.voter_address,
        tokenTransferTxid: credential.token_transfer_txid,
        credentialRecordTxid: credential.credential_record_txid
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

    const { choice, privateKeySimulation, voterAddress } = req.body ?? {};
    if (!choice) {
      throw new HttpError(400, "VOTE_INVALID_PAYLOAD", "Escolha do voto é obrigatória.");
    }

    if (election.candidates.length === 0) {
      throw new HttpError(400, "BALLOT_NOT_CONFIGURED", "A eleição ainda não possui opções de voto cadastradas.");
    }

    if (!election.candidates.some((candidate) => candidate.number === choice)) {
      throw new HttpError(400, "VOTE_CHOICE_NOT_FOUND", "A opção de voto selecionada não existe nesta eleição.");
    }

    let addressForVote = typeof voterAddress === "string" ? voterAddress : "";
    let credential = null as Awaited<ReturnType<typeof blockchain.issueCredential>> | null;

    if (!addressForVote) {
      if (!privateKeySimulation) {
        throw new HttpError(400, "VOTE_INVALID_PAYLOAD", "Chave privada é obrigatória.");
      }

      const publicKey = derivePublicKey(privateKeySimulation);
      const voter = store.all().voters.find((item) => item.electionId === election.id && item.publicKey === publicKey);
      if (!voter) {
        throw new HttpError(404, "VOTER_NOT_REGISTERED", "Eleitor não cadastrado para esta eleição.");
      }

      if (voter.voterAddress) {
        addressForVote = voter.voterAddress;
      } else {
        credential = await blockchain.issueCredential(election.chainElectionId, voter.voterIdHash);
        voter.credentialRecordTxid = credential.credential_record_txid;
        voter.voterAddress = credential.voter_address;
        voter.tokenTransferTxid = credential.token_transfer_txid;
        addressForVote = credential.voter_address;
        store.save();
      }
    }

    const result = await blockchain.castVote(election.chainElectionId, choice, addressForVote);
    const receipt = {
      id: randomUUID(),
      electionId: election.id,
      txid: result.txid,
      receiptHash: null,
      status: "PENDING",
      blockheight: null,
      confirmations: null,
      createdAt: now()
    };

    store.all().receipts.push(receipt);
    store.save();

    res.status(201).json({
      data: {
        status: "vote_sent",
        txid: result.txid,
        voterAddress: addressForVote,
        credential,
        burnAddress: result.burn_address,
        receipt: result.receipt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/elections/:electionId/votes/:txid/receipt", requireAuth, async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const receipt = await blockchain.receipt(election.chainElectionId, routeParam(req.params.txid, "txid"));
    res.json({ data: receipt });
  } catch (error) {
    next(error);
  }
});

router.get("/elections/:electionId/audit", requireAuth, requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const election = getElectionOrThrow(routeParam(req.params.electionId, "electionId"));
    const audit = await blockchain.audit(election.chainElectionId);
    res.json({ data: audit });
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

