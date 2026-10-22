import "dotenv/config";
import { io } from "socket.io-client";
import { print } from "pdf-to-printer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

function parseNonNegativeInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3333";
const PRINTER_NAME = process.env.PRINTER_NAME;
const PRINT_AGENT_SECRET = process.env.PRINT_AGENT_SECRET;
const PRINT_INTERVAL_MS = parseNonNegativeInt(process.env.PRINT_INTERVAL_MS, 5000);
const PRINT_MAX_RETRIES = parseNonNegativeInt(process.env.PRINT_MAX_RETRIES, 2);
const RETRY_DELAY_MS = 1000;

interface PrintReceiptPayload {
  txid: string;
  hash: string;
  qrCodeBase64?: string;
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] [PrintAgent] ${message}`);
}

function logError(message: string, error?: unknown): void {
  if (error !== undefined) {
    console.error(`[${new Date().toISOString()}] [PrintAgent] ${message}`, error);
  } else {
    console.error(`[${new Date().toISOString()}] [PrintAgent] ${message}`);
  }
}

/** Read width/height from a PNG file header (bytes 16-23). */
function pngSize(filePath: string): { w: number; h: number } {
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * Generates the receipt PDF and sends it to the configured printer.
 * Resolves only when PDF generation and the physical print command finish.
 */
async function printReceiptJob(payload: PrintReceiptPayload): Promise<void> {
  const { txid, hash, qrCodeBase64 } = payload;
  const tmpPdfPath = path.join(process.cwd(), `receipt_${randomUUID()}.pdf`);

  try {
    // ── Layout constants (all values in PDF points, 1pt ≈ 0.35mm) ──
    const W   = 226;          // page width (~80mm thermal roll)
    const M   = 8;            // side margin
    const TW  = W - M * 2;   // usable text width
    const PAD = 2;            // top & bottom page padding (~0.7mm)
    const GAP = 3;            // inter-section gap (~1mm)

    // ── Pre-compute URL ──
    const baseUrl  = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
    const fullUrl  = `${baseUrl}/comprovante`;

    // ── Logo dimensions ──
    const logoPath = path.join(process.cwd(), "assets", "logo-black.png");
    const hasLogo  = fs.existsSync(logoPath);
    const logoRenderW = 55;                                         // desired print width
    let   logoRenderH = 40;                                         // fallback
    if (hasLogo) {
      const { w, h } = pngSize(logoPath);
      logoRenderH = (h / w) * logoRenderW;                         // keep aspect ratio
    }

    // ── Eureka logo dimensions ──
    const eurekaPath = path.join(process.cwd(), "assets", "logo_eureka_2026_preta.png");
    const hasEureka  = fs.existsSync(eurekaPath);
    const eurekaRenderW = 28;
    let   eurekaRenderH = 28;                                       // ~square fallback
    if (hasEureka) {
      const { w, h } = pngSize(eurekaPath);
      eurekaRenderH = (h / w) * eurekaRenderW;
    }

    // ── QR buffer (reused across passes) ──
    let qrBuf: Buffer | null = null;
    if (qrCodeBase64) {
      qrBuf = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    }
    const QR_W = 95;

    // ── Render function — draws everything and returns final Y ──
    function draw(doc: InstanceType<typeof PDFDocument>): number {
      let y = PAD;

      // 1. Header row: Eureka (left) | Votify (center) | Grupo CMD06 (right)
      const cmdFontSize = 7;
      doc.fontSize(cmdFontSize);
      const cmdTextH = doc.currentLineHeight();
      const rowH = Math.max(
        hasEureka ? eurekaRenderH : 0,
        hasLogo   ? logoRenderH   : 0,
        cmdTextH
      );

      if (hasEureka) {
        doc.image(eurekaPath, M, y + (rowH - eurekaRenderH) / 2, { width: eurekaRenderW });
      }

      if (hasLogo) {
        doc.image(logoPath, (W - logoRenderW) / 2, y + (rowH - logoRenderH) / 2, { width: logoRenderW });
      }

      doc.fontSize(cmdFontSize);
      const cmdW = doc.widthOfString("Grupo CMD06");
      doc.text("Grupo CMD06", W - M - cmdW, y + (rowH - cmdTextH) / 2, { lineBreak: false });

      y += rowH;

      // 2. Title
      y += GAP;
      doc.fontSize(11).text("Comprovante de Voto", M, y, {
        align: "center", width: TW,
      });
      y = doc.y;

      // 3. TXID
      y += GAP;
      doc.fontSize(7).text(`TXID: ${txid}`, M, y, { width: TW });
      y = doc.y;

      // 4. Hash
      y += 2;
      doc.fontSize(7).text(`Hash: ${hash}`, M, y, { width: TW });
      y = doc.y;

      // 5. QR Code
      if (qrBuf) {
        y += GAP;
        doc.image(qrBuf, (W - QR_W) / 2, y, { width: QR_W });
        y += QR_W;
      }

      // 6. "Validar em:" + full URL
      y += 4;
      const valFontSize = 5;
      doc.fontSize(valFontSize);
      const valText = `Validar em: ${fullUrl}`;
      const valTextH = doc.heightOfString(valText, { width: TW });
      doc.text(valText, M, y, { align: "center", width: TW });
      y += valTextH;

      return y;   // final content bottom (manual tracking)
    }

    // ── Pass 1: measure on a tall scratch page (margin:0 = no auto page-break) ──
    const scratchDoc = new PDFDocument({ size: [W, 800], margin: 0 });
    const scratchWs = fs.createWriteStream(tmpPdfPath);
    scratchDoc.pipe(scratchWs);
    const contentBottom = draw(scratchDoc);
    const scratchDone = new Promise<void>((res, rej) => {
      scratchWs.on("finish", () => res());
      scratchWs.on("error", rej);
    });
    scratchDoc.end();
    await scratchDone;

    const pageH = contentBottom + 8;  // generous bottom margin to avoid clipping
    log(`Altura calculada do recibo (TXID: ${txid}): ${pageH.toFixed(1)}pt`);

    // ── Pass 2: render on exact-height page ──
    const doc = new PDFDocument({ size: [W, pageH], margin: 0 });
    const ws  = fs.createWriteStream(tmpPdfPath);
    doc.pipe(ws);
    draw(doc);

    const done = new Promise<void>((res, rej) => {
      ws.on("finish", () => res());
      ws.on("error", rej);
    });
    doc.end();
    await done;

    // ── Send to printer (resolves when SumatraPDF finishes spooling) ──
    if (PRINTER_NAME) {
      await print(tmpPdfPath, { printer: PRINTER_NAME });
    } else {
      await print(tmpPdfPath);
    }
  } finally {
    if (fs.existsSync(tmpPdfPath)) {
      try {
        fs.unlinkSync(tmpPdfPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ── Serial FIFO Print Queue & State ──
const printQueue: PrintReceiptPayload[] = [];
const queuedOrActiveTxids = new Set<string>();
const printedTxids = new Set<string>();

let activeWorkerPromise: Promise<void> | null = null;
let lastPrintFinishedAt: number | null = null;
let isShuttingDown = false;
let sleepAbort: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sleepAbort = null;
      resolve();
    }, ms);
    sleepAbort = () => {
      clearTimeout(timer);
      sleepAbort = null;
      resolve();
    };
  });
}

const socket = io(BACKEND_URL, {
  auth: { token: PRINT_AGENT_SECRET },
});

socket.on("connect_error", (err) => {
  logError(`Falha na conexão/autenticação: ${err.message}`);
});

socket.on("connect", () => {
  log(
    `Conectado ao servidor Backend em ${BACKEND_URL} (intervalo=${PRINT_INTERVAL_MS}ms, retentativas=${PRINT_MAX_RETRIES})`
  );
});

async function processQueue(): Promise<void> {
  while (printQueue.length > 0 && !isShuttingDown) {
    // Ensure PRINT_INTERVAL_MS has elapsed since the end of the last print,
    // even if the queue was briefly empty when the previous print finished.
    if (lastPrintFinishedAt !== null && PRINT_INTERVAL_MS > 0) {
      const elapsed = Date.now() - lastPrintFinishedAt;
      if (elapsed < PRINT_INTERVAL_MS) {
        const remainingMs = PRINT_INTERVAL_MS - elapsed;
        log(
          `Iniciando pausa de ${remainingMs}ms antes do próximo item. Tamanho atual da fila: ${printQueue.length}`
        );
        await sleep(remainingMs);
        if (isShuttingDown) {
          break;
        }
        log(
          `Fim da pausa de ${remainingMs}ms. Tamanho atual da fila: ${printQueue.length}`
        );
      }
    }

    if (isShuttingDown) {
      break;
    }

    const job = printQueue.shift();
    if (!job) {
      break;
    }

    const { txid } = job;
    const totalAttempts = PRINT_MAX_RETRIES + 1;
    let printedSuccessfully = false;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        log(
          `Iniciando impressão para TXID: ${txid} (tentativa ${attempt}/${totalAttempts}). Tamanho atual da fila: ${printQueue.length}`
        );
        await printReceiptJob(job);
        lastPrintFinishedAt = Date.now();
        printedSuccessfully = true;
        log(
          `Fim da impressão com sucesso para TXID: ${txid}. Tamanho atual da fila: ${printQueue.length}`
        );
        break;
      } catch (err) {
        lastPrintFinishedAt = Date.now();
        lastError = err;
        logError(
          `Erro na impressão para TXID: ${txid} (tentativa ${attempt}/${totalAttempts}). Tamanho atual da fila: ${printQueue.length}:`,
          err
        );

        if (attempt < totalAttempts && !isShuttingDown) {
          log(`Aguardando ${RETRY_DELAY_MS}ms antes de retentar TXID: ${txid}...`);
          await sleep(RETRY_DELAY_MS);
          if (isShuttingDown) {
            break;
          }
        }
      }
    }

    queuedOrActiveTxids.delete(txid);

    if (printedSuccessfully) {
      printedTxids.add(txid);
      socket.emit("print_receipt_ack", { txid, success: true });
    } else {
      logError(
        `Falha definitiva ao processar TXID: ${txid} após ${totalAttempts} tentativa(s). Seguindo para o próximo item da fila.`
      );
      socket.emit("print_receipt_ack", {
        txid,
        success: false,
        error: String(lastError),
      });
    }

    // Wait PRINT_INTERVAL_MS after the real end of the print only if there are more items in the queue
    if (printQueue.length > 0 && !isShuttingDown && PRINT_INTERVAL_MS > 0) {
      log(
        `Iniciando pausa de ${PRINT_INTERVAL_MS}ms após fim da impressão. Tamanho atual da fila: ${printQueue.length}`
      );
      await sleep(PRINT_INTERVAL_MS);
      lastPrintFinishedAt = Date.now();
      if (!isShuttingDown) {
        log(
          `Fim da pausa de ${PRINT_INTERVAL_MS}ms. Tamanho atual da fila: ${printQueue.length}`
        );
      }
    }
  }
}

function enqueuePrintJob(payload: PrintReceiptPayload): void {
  if (isShuttingDown) {
    log(
      `Processo em encerramento: rejeitando novo evento para TXID: ${payload?.txid ?? "desconhecido"}.`
    );
    return;
  }

  if (!payload || !payload.txid) {
    logError("Evento print_receipt recebido sem TXID válido; ignorando.", payload);
    return;
  }

  const { txid } = payload;

  if (printedTxids.has(txid) || queuedOrActiveTxids.has(txid)) {
    log(
      `Evento duplicado ignorado para TXID: ${txid}. Tamanho atual da fila: ${printQueue.length}`
    );
    return;
  }

  queuedOrActiveTxids.add(txid);
  printQueue.push(payload);
  log(
    `Evento enfileirado para TXID: ${txid}. Tamanho atual da fila: ${printQueue.length}`
  );

  if (!activeWorkerPromise) {
    activeWorkerPromise = processQueue().finally(() => {
      activeWorkerPromise = null;
    });
  }
}

socket.on("print_receipt", (payload: PrintReceiptPayload) => {
  enqueuePrintJob(payload);
});

async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  log(
    `Sinal ${signal} recebido. Parando de aceitar novos eventos (itens pendentes na fila: ${printQueue.length})...`
  );

  // Stop accepting new print events
  socket.off("print_receipt");

  // If the worker is sleeping between prints, cancel the sleep immediately
  if (sleepAbort) {
    sleepAbort();
  }

  if (activeWorkerPromise) {
    log("Aguardando conclusão da impressão em andamento antes de encerrar...");
    try {
      await activeWorkerPromise;
    } catch (err) {
      logError("Erro ao aguardar conclusão da impressão durante encerramento:", err);
    }
  }

  socket.disconnect();
  log("Print Agent encerrado com segurança.");
  process.exit(0);
}

process.on("SIGINT", () => {
  void handleShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void handleShutdown("SIGTERM");
});
