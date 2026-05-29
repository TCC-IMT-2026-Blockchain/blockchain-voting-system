import { execFile } from "node:child_process";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";

function publicBlockchainMessage(raw: string) {
  const text = raw.toLowerCase();

  if (text.includes("filter aborted due to timeout")) {
    return "O filtro da blockchain demorou mais que o limite configurado. Tente novamente ou reinicie a rede.";
  }

  if (text.includes("credencial já emitida") || text.includes("credential already issued")) {
    return "Credencial já emitida para este eleitor.";
  }

  if (
    text.includes("insufficient") ||
    text.includes("not enough") ||
    text.includes("no spendable") ||
    text.includes("sem saldo") ||
    text.includes("saldo insuficiente") ||
    text.includes("deve gastar exatamente um token") ||
    text.includes("deve queimar exatamente um token")
  ) {
    return "O eleitor não pode votar duas vezes.";
  }

  const rejection = raw.match(/(?:Transação de voto rejeitada|Item da urna rejeitado):\s*(.+)/i);
  if (rejection?.[1]) {
    return `Voto rejeitado pela blockchain: ${rejection[1].trim()}`;
  }

  return "Falha ao executar comando na blockchain.";
}

function runBlockchain(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(
      "python",
      ["scripts/votify.py", ...args],
      {
        cwd: env.blockchainDir,
        shell: false,
        timeout: 60_000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          const details = (stderr || stdout || error.message).trim();
          reject(
            new HttpError(
              503,
              "BLOCKCHAIN_COMMAND_FAILED",
              publicBlockchainMessage(details),
              details
            )
          );
          return;
        }

        const output = stdout.trim();
        if (!output) {
          resolve(null);
          return;
        }

        try {
          resolve(JSON.parse(output));
        } catch {
          resolve(output);
        }
      }
    );
  });
}

export const blockchain = {
  hashCpf(cpf: string, electionId: string) {
    return runBlockchain([
      "hash-cpf",
      "--cpf",
      cpf,
      "--secret",
      env.cpfSecret,
      "--election-id",
      electionId
    ]) as Promise<string>;
  },

  registerVoter(electionId: string, voterIdHash: string, publicKey: string) {
    return runBlockchain([
      "register-voter",
      "--election-id",
      electionId,
      "--voter-id-hash",
      voterIdHash,
      "--public-key",
      publicKey
    ]) as Promise<{ identity_txid: string }>;
  },

  issueCredential(electionId: string, voterIdHash: string) {
    return runBlockchain([
      "issue-credential",
      "--election-id",
      electionId,
      "--voter-id-hash",
      voterIdHash
    ]) as Promise<{
      voter_address: string;
      token_transfer_txid: string;
      credential_record_txid: string;
    }>;
  },

  castVote(electionId: string, choice: string, voterAddress: string) {
    return runBlockchain([
      "cast-vote",
      "--election-id",
      electionId,
      "--choice",
      choice,
      "--voter-address",
      voterAddress
    ]) as Promise<{ txid: string; burn_address: string; receipt: unknown }>;
  },

  receipt(electionId: string, txid: string) {
    return runBlockchain(["receipt", "--election-id", electionId, "--txid", txid]);
  },

  audit(electionId: string) {
    return runBlockchain(["audit", "--election-id", electionId]);
  },

  status() {
    return runBlockchain(["status"]);
  },

  lockGovernance() {
    return runBlockchain(["lock-governance"]) as Promise<unknown>;
  }
};
