import type { Response } from "express";
import { randomUUID } from "node:crypto";

export type VisualSystem = "votify" | "votifalho";

export type VisualEventType =
  | "voter_registration"
  | "ballot_saved"
  | "election_locked"
  | "election_lock_rejected"
  | "vote_cast"
  | "vote_rejected"
  | "vote_confirmed"
  | "receipt_verified"
  | "receipt_rejected"
  | "audit_recalculated"
  | "vote_change_attempt"
  | "consensus_checked"
  | "node_compromised"
  | "node_offline"
  | "node_restored";

export interface VisualEvent {
  id: string;
  type: VisualEventType;
  system: VisualSystem;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

type VisualEventInput = Omit<VisualEvent, "id" | "occurredAt"> & {
  occurredAt?: string;
};

function sendSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

class VisualEventBus {
  private readonly clients = new Set<Response>();
  private readonly history: VisualEvent[] = [];

  subscribe(res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    this.clients.add(res);
    sendSse(res, "connected", {
      connected: true,
      history: this.history.filter((event) => event.system === "votify").slice(-8)
    });

    const heartbeat = setInterval(() => {
      sendSse(res, "heartbeat", { at: new Date().toISOString() });
    }, 15_000);

    res.on("close", () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
    });
  }

  publish(input: VisualEventInput) {
    if (input.system !== "votify") return null;

    const event: VisualEvent = {
      id: randomUUID(),
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      type: input.type,
      system: input.system,
      metadata: input.metadata
    };

    this.history.push(event);
    if (this.history.length > 20) {
      this.history.shift();
    }

    for (const client of this.clients) {
      sendSse(client, "visual_event", event);
    }

    return event;
  }
}

export const visualEvents = new VisualEventBus();
