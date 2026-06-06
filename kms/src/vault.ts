import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const VAULT_URL = process.env.VAULT_URL || "http://127.0.0.1:8200";
const VAULT_TOKEN = process.env.VAULT_TOKEN || "votify-tcc-token";

const vaultClient = axios.create({
    baseURL: VAULT_URL,
    headers: {
        "X-Vault-Token": VAULT_TOKEN,
        "Content-Type": "application/json"
    }
});

export interface VaultSecretData {
    encryptedPrivateKey: string;
    iv: string;
    authTag: string;
}

export async function storeVoterSecret(voterIdHash: string, data: VaultSecretData) {
    // Vault KV-v2 endpoint for creating/updating a secret
    // Path: /v1/secret/data/voters/:voterIdHash
    const response = await vaultClient.post(`/v1/secret/data/voters/${voterIdHash}`, {
        data: data
    });
    return response.data;
}

export async function getVoterSecret(voterIdHash: string): Promise<VaultSecretData> {
    // Vault KV-v2 endpoint for reading a secret
    const response = await vaultClient.get(`/v1/secret/data/voters/${voterIdHash}`);
    return response.data.data.data as VaultSecretData;
}
