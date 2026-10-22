import "dotenv/config";
import { print } from "pdf-to-printer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const PRINTER_NAME = process.env.PRINTER_NAME;
const START_NUMBER = Number(process.env.START_NUMBER ?? 0);
const END_NUMBER = Number(process.env.END_NUMBER ?? 999);
const SLEEP_MS = Number(process.env.SLEEP_MS ?? 7000);

const STATE_FILE_PATH = path.join(__dirname, "sequence-state.json");

interface SequenceState {
  lastPrinted: string;
  updatedAt: string;
}

/** Read width/height from a PNG file header (bytes 16-23). */
function pngSize(filePath: string): { w: number; h: number } {
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Always format number as a strict 3-digit zero-padded string ("000", "001", "002", ..., "999"). */
function formatNumber(n: number): string {
  return String(n).padStart(3, "0");
}

/** Read persisted sequence state if available. */
function loadState(): { lastPrintedNumber: number; lastPrinted: string; updatedAt: string } | null {
  if (!fs.existsSync(STATE_FILE_PATH)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(STATE_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { lastPrinted?: string | number; updatedAt?: string };
    if (parsed.lastPrinted !== undefined && parsed.lastPrinted !== null) {
      const numeric = Number(parsed.lastPrinted);
      if (!Number.isNaN(numeric)) {
        return {
          lastPrintedNumber: numeric,
          lastPrinted: formatNumber(numeric),
          updatedAt: parsed.updatedAt ?? "",
        };
      }
    }
  } catch (err) {
    console.warn(`[PrintNumbers] Aviso: falha ao ler ${STATE_FILE_PATH}:`, err);
  }
  return null;
}

/** Persist the last printed number atomically as a 3-digit string ("000".."999"). */
function saveState(lastPrintedNumeric: number): SequenceState {
  const state: SequenceState = {
    lastPrinted: formatNumber(lastPrintedNumeric),
    updatedAt: new Date().toISOString(),
  };
  const tmpPath = `${STATE_FILE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tmpPath, STATE_FILE_PATH);
  return state;
}

/** Resolve Votify logo path (local assets first, fallback to print-agent/assets). */
function resolveLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, "assets", "logo-black.png"),
    path.join(process.cwd(), "assets", "logo-black.png"),
    path.join(__dirname, "..", "print-agent", "assets", "logo-black.png"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Generate the PDF for a single number using the "Compacto Equilibrado" layout:
 * - Page width: 226pt (~80mm thermal roll)
 * - Top: Votify black logo centered
 * - Center: 3-digit number in Helvetica-Bold 48pt
 * - Page height: ~90pt (~3.2cm)
 */
async function generateNumberPdf(formattedNumber: string, outputPath: string): Promise<number> {
  // ── Layout constants (all values in PDF points, 1pt ≈ 0.3528mm) ──
  const W = 226;             // page width (~80mm thermal roll)
  const M = 8;               // side margin
  const TW = W - M * 2;      // usable text width (210pt)
  const PAD_TOP = 6;         // top padding (~2.1mm)
  const GAP = 6;             // gap between logo and number (~2.1mm)
  const FONT_SIZE = 48;      // Compacto Equilibrado (~1.7cm character height)
  const MIN_PAGE_H = 90;     // Compacto Equilibrado height (~3.2cm)

  const logoPath = resolveLogoPath();
  const logoRenderW = 55;
  let logoRenderH = 0;
  if (logoPath) {
    const { w, h } = pngSize(logoPath);
    logoRenderH = (h / w) * logoRenderW;
  }

  function draw(doc: InstanceType<typeof PDFDocument>): number {
    let y = PAD_TOP;

    // 1. Votify Logo (centered)
    if (logoPath && logoRenderH > 0) {
      doc.image(logoPath, (W - logoRenderW) / 2, y, { width: logoRenderW });
      y += logoRenderH + GAP;
    }

    // 2. Sequential Number in Bold (centered)
    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_SIZE)
      .text(formattedNumber, M, y, {
        align: "center",
        width: TW,
        lineBreak: false,
      });

    y += doc.currentLineHeight();
    return y;
  }

  // ── Pass 1: measure on a scratch page (margin: 0 prevents auto page-break) ──
  const scratchDoc = new PDFDocument({ size: [W, 400], margin: 0 });
  const scratchStream = fs.createWriteStream(outputPath);
  scratchDoc.pipe(scratchStream);
  const contentBottom = draw(scratchDoc);
  const scratchDone = new Promise<void>((res, rej) => {
    scratchStream.on("finish", () => res());
    scratchStream.on("error", rej);
  });
  scratchDoc.end();
  await scratchDone;

  const pageH = Math.max(MIN_PAGE_H, Math.ceil(contentBottom + 8));

  // ── Pass 2: render on exact-height page ──
  const doc = new PDFDocument({ size: [W, pageH], margin: 0 });
  const ws = fs.createWriteStream(outputPath);
  doc.pipe(ws);
  draw(doc);

  const done = new Promise<void>((res, rej) => {
    ws.on("finish", () => res());
    ws.on("error", rej);
  });
  doc.end();
  await done;

  return pageH;
}

/** Interruptible sleep helper so Ctrl+C stops immediately. */
let stopRequested = false;
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

process.on("SIGINT", () => {
  console.log("\n[PrintNumbers] Interrupção solicitada (Ctrl+C). Encerrando de forma segura...");
  stopRequested = true;
  if (sleepAbort) sleepAbort();
});

process.on("SIGTERM", () => {
  console.log("\n[PrintNumbers] Sinal de término recebido. Encerrando de forma segura...");
  stopRequested = true;
  if (sleepAbort) sleepAbort();
});

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");
  const isDryRun = args.includes("--dry-run");

  if (shouldReset && fs.existsSync(STATE_FILE_PATH)) {
    fs.unlinkSync(STATE_FILE_PATH);
    console.log("[PrintNumbers] Estado anterior removido (--reset). Reiniciando contagem do 000.");
  }

  const existingState = loadState();
  let startFrom = START_NUMBER;

  if (existingState !== null) {
    startFrom = existingState.lastPrintedNumber + 1;
    console.log(
      `[PrintNumbers] Estado encontrado: último número impresso foi ${existingState.lastPrinted} (em ${existingState.updatedAt}).`
    );
  } else {
    console.log(`[PrintNumbers] Nenhum estado anterior encontrado. Iniciando do ${formatNumber(startFrom)}.`);
  }

  if (startFrom > END_NUMBER) {
    console.log(
      `[PrintNumbers] Todos os números até ${formatNumber(END_NUMBER)} já foram impressos!`
    );
    console.log(
      `[PrintNumbers] Para reiniciar do 000, execute: npm run reset (ou .\\start-print-numbers.ps1 -Reset)`
    );
    return;
  }

  console.log("------------------------------------------------------------");
  console.log(`[PrintNumbers] Impressora alvo : ${PRINTER_NAME || "(Impressora Padrão do Sistema)"}`);
  console.log(`[PrintNumbers] Intervalo       : ${formatNumber(startFrom)} até ${formatNumber(END_NUMBER)}`);
  console.log(`[PrintNumbers] Tempo de espera : ${SLEEP_MS / 1000}s entre impressões`);
  if (isDryRun) {
    console.log(`[PrintNumbers] Modo            : DRY-RUN (sem envio físico para impressora)`);
  }
  console.log("------------------------------------------------------------\n");

  for (let current = startFrom; current <= END_NUMBER; current++) {
    if (stopRequested) {
      break;
    }

    const formatted = formatNumber(current);
    const tmpPdfPath = path.join(__dirname, `number_${formatted}_${randomUUID()}.pdf`);

    try {
      const pageH = await generateNumberPdf(formatted, tmpPdfPath);
      console.log(
        `[PrintNumbers] [${formatted}/${formatNumber(END_NUMBER)}] PDF gerado (${pageH}pt). Enviando para impressão...`
      );

      if (!isDryRun) {
        if (PRINTER_NAME) {
          await print(tmpPdfPath, { printer: PRINTER_NAME });
        } else {
          await print(tmpPdfPath);
        }
      }

      const saved = saveState(current);
      console.log(
        `[PrintNumbers] [${formatted}/${formatNumber(END_NUMBER)}] Impresso e registrado com sucesso em sequence-state.json (${saved.updatedAt}).`
      );
    } catch (error) {
      console.error(
        `\n[PrintNumbers] ERRO ao imprimir o número ${formatted}:`,
        error
      );
      console.error(
        `[PrintNumbers] Execução interrompida. Quando rodar novamente, o script retomará automaticamente do número ${formatted}.`
      );
      process.exitCode = 1;
      break;
    } finally {
      if (fs.existsSync(tmpPdfPath)) {
        try {
          fs.unlinkSync(tmpPdfPath);
        } catch {
          // ignore cleanup error
        }
      }
    }

    if (current < END_NUMBER && !stopRequested) {
      console.log(`[PrintNumbers] Aguardando ${SLEEP_MS / 1000} segundos antes do próximo número (${formatNumber(current + 1)})...`);
      await sleep(SLEEP_MS);
    }
  }

  const finalState = loadState();
  if (stopRequested) {
    console.log(
      `\n[PrintNumbers] Execução pausada. Último número impresso salvo: ${
        finalState ? finalState.lastPrinted : "nenhum"
      }.`
    );
  } else if (finalState && finalState.lastPrintedNumber >= END_NUMBER) {
    console.log(
      `\n[PrintNumbers] Sequência completa finalizada com sucesso! Último número impresso: ${finalState.lastPrinted}.`
    );
  }
}

main().catch((err) => {
  console.error("[PrintNumbers] Erro inesperado:", err);
  process.exit(1);
});
