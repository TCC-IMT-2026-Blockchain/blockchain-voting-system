import express from "express";
import { encryptAESGCM, decryptAESGCM, generatePin, secureMemoryWipe } from "./crypto";
import { createKeyPairs, signRawTransaction } from "./multichain";
import { storeVoterSecret, getVoterSecret } from "./vault";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4444;

app.post("/api/v1/keys/generate", async (req, res) => {
    try {
        const { voterIdHash } = req.body;
        if (!voterIdHash) {
            return res.status(400).json({ error: "Missing voterIdHash" });
        }

        // 1. Generate keys from MultiChain
        const keyPair = await createKeyPairs();

        // 2. Generate secure random PIN
        const pin = generatePin();

        // 3. Encrypt private key with AES-256-GCM using the PIN
        const encryptedData = encryptAESGCM(keyPair.privkey, pin);

        // 4. Store securely in Vault
        await storeVoterSecret(voterIdHash, encryptedData);

        // 5. Secure memory wipe of the plaintext key object
        secureMemoryWipe({ key: keyPair.privkey });

        // 6. Return only necessary data to Backend
        res.json({
            address: keyPair.address,
            pubKey: keyPair.pubkey,
            pin: pin
        });
    } catch (err: any) {
        console.error("Error generating keys:", err.message);
        res.status(500).json({ error: "Failed to generate keys" });
    }
});

app.post("/api/v1/keys/sign", async (req, res) => {
    try {
        const { voterIdHash, pin, unsignedTxHex } = req.body;
        if (!voterIdHash || !pin || !unsignedTxHex) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // 1. Retrieve encrypted secret from Vault
        const vaultData = await getVoterSecret(voterIdHash);
        if (!vaultData || !vaultData.encryptedPrivateKey) {
            return res.status(404).json({ error: "Secret not found for this voter" });
        }

        let privateKey = "";
        try {
            // 2. Decrypt the private key
            privateKey = decryptAESGCM(vaultData.encryptedPrivateKey, vaultData.iv, vaultData.authTag, pin);
        } catch (decryptErr) {
            // Decryption fails if the PIN is incorrect
            return res.status(401).json({ error: "Unauthorized: Incorrect PIN" });
        }

        // 3. Sign the transaction using MultiChain node
        const signedHex = await signRawTransaction(unsignedTxHex, privateKey);

        // 4. Secure memory wipe
        secureMemoryWipe({ key: privateKey });
        privateKey = "0000000000000000000000000000000000000000000000000000000000000000"; // Extra wipe

        // 5. Return signed hex
        res.json({ signedTxHex: signedHex });
    } catch (err: any) {
        console.error("Error signing transaction:", err.message);
        res.status(500).json({ error: "Failed to sign transaction" });
    }
});

app.listen(PORT, () => {
    console.log(`KMS Microservice listening on port ${PORT}`);
});
