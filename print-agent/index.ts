import "dotenv/config";
import { io } from "socket.io-client";
import { print } from "pdf-to-printer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3333";
const PRINTER_NAME = process.env.PRINTER_NAME;
const PRINT_AGENT_SECRET = process.env.PRINT_AGENT_SECRET;

const socket = io(BACKEND_URL, {
  auth: { token: PRINT_AGENT_SECRET },
});

socket.on("connect_error", (err) => {
  console.error(`[PrintAgent] Falha na conexão/autenticação: ${err.message}`);
});

socket.on("connect", () => {
  console.log(`[PrintAgent] Conectado ao servidor Backend em ${BACKEND_URL}`);
});

/** Read width/height from a PNG file header (bytes 16-23). */
function pngSize(filePath: string): { w: number; h: number } {
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// No longer cached — recalculated per print to avoid stale-height clipping.

socket.on("print_receipt", async (payload) => {
  const { txid, hash, qrCodeBase64 } = payload;
  const tmpPdfPath = path.join(process.cwd(), `receipt_${randomUUID()}.pdf`);

  try {
    console.log(`[PrintAgent] Recebido job de impressão para TXID: ${txid}`);

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
    scratchDoc.pipe(fs.createWriteStream(tmpPdfPath));
    const contentBottom = draw(scratchDoc);
    scratchDoc.end();
    await new Promise<void>((r) => setTimeout(r, 80));

    const pageH = contentBottom + 8;  // generous bottom margin to avoid clipping
    console.log(`[PrintAgent] Altura calculada do recibo: ${pageH.toFixed(1)}pt`);

    // ── Pass 2: render on exact-height page ──
    const doc = new PDFDocument({ size: [W, pageH], margin: 0 });
    const ws  = fs.createWriteStream(tmpPdfPath);
    doc.pipe(ws);
    draw(doc);

    const done = new Promise((res, rej) => { ws.on("finish", res); ws.on("error", rej); });
    doc.end();
    await done;

    // ── Send to printer ──
    if (PRINTER_NAME) {
      await print(tmpPdfPath, { printer: PRINTER_NAME });
    } else {
      await print(tmpPdfPath);
    }
    console.log(`[PrintAgent] Job ${txid} impresso com sucesso.`);
    socket.emit("print_receipt_ack", { txid, success: true });
  } catch (error) {
    console.error(`[PrintAgent] Falha ao processar TXID ${txid}:`, error);
    socket.emit("print_receipt_ack", { txid, success: false, error: String(error) });
  } finally {
    if (fs.existsSync(tmpPdfPath)) fs.unlinkSync(tmpPdfPath);
  }
});
