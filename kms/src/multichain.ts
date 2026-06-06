import { execFile } from "node:child_process";
import * as dotenv from "dotenv";

dotenv.config();

const CONTAINER_NAME = process.env.MULTICHAIN_CONTAINER || "votify-master";
const CHAIN_NAME = process.env.MULTICHAIN_CHAIN || "votifychain";

const FALLBACK_NODES = ["votify-master", "votify-slave", "votify-fiscal-2"];

async function runCli(args: string[]): Promise<any> {
    let lastError: Error | null = null;
    
    for (const node of FALLBACK_NODES) {
        try {
            return await new Promise((resolve, reject) => {
                execFile(
                    "docker",
                    ["exec", node, "multichain-cli", CHAIN_NAME, ...args],
                    {
                        shell: false,
                        timeout: 30000,
                        windowsHide: true
                    },
                    (error, stdout, stderr) => {
                        if (error) {
                            return reject(new Error(`MultiChain CLI error on ${node}: ${stderr || stdout || error.message}`));
                        }
                        const output = stdout.trim();
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
            console.warn(`[KMS] Node ${node} failed, trying next...`);
        }
    }
    throw lastError;
}

export interface KeyPair {
    address: string;
    pubkey: string;
    privkey: string;
}

export async function createKeyPairs(): Promise<KeyPair> {
    const result = await runCli(["createkeypairs"]);
    if (Array.isArray(result) && result.length > 0) {
        return result[0] as KeyPair;
    }
    throw new Error("Failed to create key pairs: Invalid response from MultiChain");
}

export async function signRawTransaction(unsignedHex: string, privateKey: string): Promise<string> {
    // signrawtransaction <hexstring> [] '["privkey"]'
    const result = await runCli(["signrawtransaction", unsignedHex, "[]", JSON.stringify([privateKey])]);
    if (result && result.hex) {
        return result.hex as string;
    }
    throw new Error("Failed to sign transaction: Invalid response from MultiChain");
}
