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

socket.on("print_receipt", async (payload) => {
  const { txid, hash, qrCodeBase64 } = payload;
  const tmpPdfPath = path.join(process.cwd(), `receipt_${randomUUID()}.pdf`);

  try {
    console.log(`[PrintAgent] Recebido job de impressão para TXID: ${txid}`);
    const doc = new PDFDocument({ size: [226, 400], margin: 10 });
    const writeStream = fs.createWriteStream(tmpPdfPath);
    doc.pipe(writeStream);

    const logoPath = path.join(process.cwd(), "assets", "logo-votify.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, { fit: [100, 100], align: 'center' });
    }

    doc.moveDown();
    doc.fontSize(12).text("Comprovante de Voto", { align: "center" });
    doc.moveDown();
    doc.fontSize(8).text(`TXID:\n${txid}`);
    doc.moveDown();
    doc.text(`Hash:\n${hash}`);
    doc.moveDown();

    if (qrCodeBase64) {
      const qrImage = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ""), "base64");
      doc.image(qrImage, { fit: [150, 150], align: 'center' });
    }
    
    doc.moveDown(12);
    doc.fontSize(6).text(`Validar em:`, { align: 'center' });
    const token = Buffer.from(`${txid}:${hash}`).toString("base64");
    doc.text(`${process.env.FRONTEND_BASE_URL || "http://localhost:5173"}/comprovante`, { align: 'center' });
    doc.text(`?token=${token}`, { align: 'center' });

    const docPromise = new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    doc.end();
    await docPromise;

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
