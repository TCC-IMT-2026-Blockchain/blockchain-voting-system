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

  if (text.includes("Asset not found")) {
    return "Ativo da eleição não configurado na blockchain. Execute o setup novamente.";
  }

  if (text.includes("nenhum item da stream") || text.includes("Stream with this name not found")) {
    return "Comprovante não encontrado na blockchain.";
  }

  if (text.includes("from-address is not found")) {
    return "O nó atual não possui a chave privada deste eleitor. A carteira custodial original deve estar offline.";
  }

  return `Falha ao executar comando na blockchain: ${raw}`;
}

const FALLBACK_NODES = ["votify-master", "votify-slave", "votify-fiscal-2"];

async function runBlockchain(args: string[]): Promise<unknown> {
  const hasExplicitMaster = args.includes("--master");
  const nodesToTry = hasExplicitMaster ? [null] : FALLBACK_NODES;

  let lastError: Error | null = null;

  for (const node of nodesToTry) {
    const finalArgs = node && !hasExplicitMaster ? [...args, "--master", node] : args;

    try {
      return await new Promise((resolve, reject) => {
        execFile(
          "python",
          ["scripts/votify.py", ...finalArgs],
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
    } catch (err: any) {
      lastError = err;
      if (err instanceof HttpError && !err.message.startsWith("Falha ao executar comando na blockchain")) {
        throw err;
      }
    }
  }

  throw lastError;
}

function runDocker(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "docker",
      args,
      {
        cwd: env.blockchainDir,
        shell: false,
        timeout: 30_000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new HttpError(
              503,
              "DOCKER_COMMAND_FAILED",
              "Falha ao executar comando Docker.",
              (stderr || stdout || error.message).trim()
            )
          );
          return;
        }

        resolve(stdout.trim());
      }
    );
  });
}

function withNode(args: string[], container: string) {
  return [...args, "--master", container];
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

  async registerVoter(electionId: string, voterIdHash: string) {
    // 1. Generate keys via KMS
    let kmsResponse: Response;
    try {
      kmsResponse = await fetch("http://127.0.0.1:4444/api/v1/keys/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterIdHash })
      });
    } catch (err) {
      throw new HttpError(503, "KMS_UNAVAILABLE", "O microsserviço KMS (porta 4444) não está respondendo. Verifique se ele está rodando.", "KMS connection failed");
    }
    if (!kmsResponse.ok) {
      const err = await kmsResponse.json().catch(() => ({}));
      throw new Error("KMS Error: " + (err.error || "Failed to generate keys"));
    }
    const kmsData = await kmsResponse.json() as { address: string, pubKey: string, pin: string };

    // 2. Import address as watch-only
    await this.importAddress(kmsData.address);

    // 3. Register voter on blockchain
    const result = await runBlockchain([
      "register-voter",
      "--election-id",
      electionId,
      "--voter-id-hash",
      voterIdHash,
      "--public-key",
      kmsData.pubKey
    ]) as { identity_txid: string };

    return {
      identity_txid: result.identity_txid,
      address: kmsData.address,
      pin: kmsData.pin
    };
  },

  async importAddress(address: string) {
    // Import address to all fallback nodes so they can track its UTXOs
    for (const node of FALLBACK_NODES) {
      try {
        await new Promise((resolve, reject) => {
          execFile(
            "docker",
            ["exec", node, "multichain-cli", "votifychain", "importaddress", address, "", "false"],
            { shell: false, timeout: 10_000, windowsHide: true },
            (err) => err ? reject(err) : resolve(null)
          );
        });
      } catch (err) {
        console.warn(`Failed to import address on ${node}`);
      }
    }
  },

  async issueCredential(electionId: string, voterIdHash: string, voterAddress: string) {
    // Issue credential on blockchain
    return runBlockchain([
      "issue-credential",
      "--election-id",
      electionId,
      "--voter-id-hash",
      voterIdHash,
      "--voter-address",
      voterAddress
    ]) as Promise<{
      voter_address: string;
      token_transfer_txid: string;
      credential_record_txid: string;
    }>;
  },

  async castVote(electionId: string, choice: string, voterAddress: string, voterIdHash: string, pin: string) {
    // 1. Create unsigned raw vote transaction
    const createResult = await runBlockchain([
      "create-raw-vote",
      "--election-id",
      electionId,
      "--choice",
      choice,
      "--voter-address",
      voterAddress
    ]) as { unsigned_tx_hex: string; burn_address: string };

    // 2. Delegate signature to KMS
    let kmsResponse: Response;
    try {
      kmsResponse = await fetch("http://127.0.0.1:4444/api/v1/keys/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voterIdHash,
          pin,
          unsignedTxHex: createResult.unsigned_tx_hex
        })
      });
    } catch (err) {
      throw new HttpError(503, "KMS_UNAVAILABLE", "O microsserviço KMS (porta 4444) não está respondendo. Verifique se ele está rodando.", "KMS connection failed");
    }
    
    if (!kmsResponse.ok) {
      if (kmsResponse.status === 401) {
        throw new HttpError(401, "UNAUTHORIZED", "O PIN informado está incorreto.", "KMS decryption failed");
      }
      throw new Error("KMS Error: Failed to sign transaction");
    }
    
    const kmsData = await kmsResponse.json() as { signedTxHex: string };

    // 3. Broadcast signed transaction
    const sendResult = await runBlockchain([
      "send-raw-vote",
      "--election-id",
      electionId,
      "--signed-hex",
      kmsData.signedTxHex
    ]) as { txid: string; receipt: unknown };

    return {
      txid: sendResult.txid,
      receipt: sendResult.receipt,
      burn_address: createResult.burn_address
    };
  },

  receipt(electionId: string, txid: string) {
    return runBlockchain(["receipt", "--election-id", electionId, "--txid", txid]);
  },

  audit(electionId: string) {
    return runBlockchain(["audit", "--election-id", electionId]);
  },

  auditFromNode(electionId: string, container: string) {
    return runBlockchain(withNode(["audit", "--election-id", electionId], container));
  },

  status() {
    return runBlockchain(["status"]);
  },

  statusFromNode(container: string) {
    return runBlockchain(withNode(["status"], container));
  },

  stopNode(container: string) {
    return runDocker(["stop", container]);
  },

  startNode(container: string) {
    return runDocker(["start", container]);
  },

  lockGovernance() {
    return runBlockchain(["lock-governance"]) as Promise<unknown>;
  }
};
