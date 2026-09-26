import { app } from "./app.js";
import { env } from "./config/env.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerPendingJob, markJobResult } from "./services/printJobRegistry.js";

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_BASE_URL || "http://localhost:5173" }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || token !== process.env.PRINT_AGENT_SECRET) {
    return next(new Error("unauthorized"));
  }
  next();
});

let printAgentSocket: import("socket.io").Socket | null = null;

io.on("connection", (socket) => {
  if (printAgentSocket) {
    printAgentSocket.disconnect(true);
  }
  printAgentSocket = socket;
  console.log("[Server] Print Agent conectado.");

  socket.on("print_receipt_ack", ({ txid, success, error }) => {
    markJobResult(txid, success, error);
  });

  socket.on("disconnect", () => {
    if (printAgentSocket === socket) printAgentSocket = null;
  });
});

export function dispatchPrintJob(txid: string, hash: string, qrCodeBase64: string) {
  registerPendingJob(txid, hash, qrCodeBase64);
  if (!printAgentSocket) {
    markJobResult(txid, false, "Print Agent offline no momento do voto.");
    return;
  }
  printAgentSocket.emit("print_receipt", { txid, hash, qrCodeBase64 });
}

server.listen(env.port, () => {
  console.log(`Votify backend running at http://localhost:${env.port}${env.apiPrefix}`);
});
