import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Candidate, Election } from "../domain/types.js";

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "traditional-db.json");

export interface TraditionalVoter {
  id: string;
  electionId: string;
  cpf: string;
  publicKey: string;
  createdAt: string;
}

export interface TraditionalVote {
  id: string;
  electionId: string;
  choice: string;
  voterId?: string;
  publicKey?: string;
  privateKeySimulation: string | null;
  txid: string;
  receiptHash: string;
  createdAt: string;
}

export interface TraditionalDatabase {
  elections: Election[];
  voters: TraditionalVoter[];
  votes: TraditionalVote[];
}

function now() {
  return new Date().toISOString();
}

function seedDatabase(): TraditionalDatabase {
  const electionId = randomUUID();

  const election: Election = {
    id: electionId,
    chainElectionId: "BANCO_TRADICIONAL_001",
    title: "Votação",
    description: "Votação usada para demonstrar fragilidades de uma arquitetura centralizada.",
    status: "OPEN",
    startsAt: now(),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    candidates: [] as Candidate[],
    createdAt: now(),
    updatedAt: now()
  };

  return {
    elections: [election],
    voters: [],
    votes: []
  };
}

export class TraditionalStore {
  constructor() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      this.save(seedDatabase());
    }
  }

  all(): TraditionalDatabase {
    if (!fs.existsSync(dbPath)) {
      return { elections: [], voters: [], votes: [] };
    }
    try {
      return JSON.parse(fs.readFileSync(dbPath, "utf8")) as TraditionalDatabase;
    } catch {
      return { elections: [], voters: [], votes: [] };
    }
  }

  save(data?: TraditionalDatabase) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data ?? this.all(), null, 2), "utf8");
  }
}

export const traditionalStore = new TraditionalStore();
