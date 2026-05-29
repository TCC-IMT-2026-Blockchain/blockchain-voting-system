import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import type { Database, Election } from "../domain/types.js";

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "db.json");

function now() {
  return new Date().toISOString();
}

function seedDatabase(): Database {
  const electionId = randomUUID();

  const election: Election = {
    id: electionId,
    chainElectionId: env.defaultChainElectionId,
    title: "Votação",
    description: "Votação usada para demonstrar o fluxo completo do Votify.",
    status: "OPEN",
    startsAt: now(),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    candidates: [],
    governanceLockedAt: null,
    createdAt: now(),
    updatedAt: now()
  };

  return {
    users: [
      {
        id: randomUUID(),
        name: "Administrador",
        email: "admin@example.com",
        password: "demo123",
        role: "ADMIN",
        token: "demo-admin-token"
      },
      {
        id: randomUUID(),
        name: "Eleitor",
        email: "elector@example.com",
        password: "demo123",
        role: "ELECTOR",
        token: "demo-elector-token"
      },
      {
        id: randomUUID(),
        name: "Auditor",
        email: "auditor@example.com",
        password: "demo123",
        role: "AUDITOR",
        token: "demo-auditor-token"
      }
    ],
    elections: [election],
    voters: [],
    receipts: []
  };
}

export class Store {
  private db: Database;

  constructor() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      this.db = seedDatabase();
      this.save();
    } else {
      this.db = JSON.parse(fs.readFileSync(dbPath, "utf8")) as Database;
    }
  }

  all() {
    return this.db;
  }

  save() {
    fs.writeFileSync(dbPath, JSON.stringify(this.db, null, 2), "utf8");
  }
}

export const store = new Store();
