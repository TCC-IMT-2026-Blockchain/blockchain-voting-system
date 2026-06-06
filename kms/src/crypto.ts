import crypto from "node:crypto";

// For AES-256-GCM, the key must be exactly 32 bytes.
// We derive a 32-byte key from the PIN using SHA-256 (for simplicity in TCC).
// In production, PBKDF2 or Scrypt with a salt is highly recommended.
function deriveKeyFromPin(pin: string): Buffer {
    return crypto.createHash("sha256").update(pin).digest();
}

export function encryptAESGCM(plainText: string, pin: string) {
    const key = deriveKeyFromPin(pin);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return {
        encryptedPrivateKey: encrypted,
        iv: iv.toString("hex"),
        authTag: authTag
    };
}

export function decryptAESGCM(encryptedHex: string, ivHex: string, authTagHex: string, pin: string): string {
    const key = deriveKeyFromPin(pin);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
}

export function generatePin(): string {
    // Generate a secure random 6-digit PIN
    const min = 100000;
    const max = 999999;
    const pin = crypto.randomInt(min, max + 1);
    return pin.toString();
}

// Secure Memory Wipe utility
export function secureMemoryWipe(obj: { key: string }) {
    // In Node.js, V8 manages memory, so true wiping is hard without native addons.
    // Overwriting the string in the reference is the best effort approach in TS.
    obj.key = "0000000000000000000000000000000000000000000000000000000000000000";
}
