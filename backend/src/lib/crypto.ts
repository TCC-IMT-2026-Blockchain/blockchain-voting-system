import { createHash } from "node:crypto";

export function derivePublicKey(privateKeySimulation: string) {
  return `pub_${createHash("sha256").update(privateKeySimulation, "utf8").digest("hex")}`;
}

export function safePublicUser(user: { id: string; name: string; email: string; role: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}
