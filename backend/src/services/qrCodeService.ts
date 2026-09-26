import QRCode from "qrcode";

export function buildVerifyUrl(txid: string, hash: string): string {
  const baseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
  const token = Buffer.from(`${txid}:${hash}`).toString("base64");
  return `${baseUrl}/comprovante?token=${token}`;
}

export async function generateQrCodeBase64(txid: string, hash: string): Promise<string> {
  const url = buildVerifyUrl(txid, hash);
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1 });
}
