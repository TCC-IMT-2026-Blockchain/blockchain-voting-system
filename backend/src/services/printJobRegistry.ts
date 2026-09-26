type PrintJobStatus = "pending" | "success" | "failed";

interface PrintJob {
  txid: string;
  hash: string;
  qrCodeBase64: string;
  status: PrintJobStatus;
  error?: string;
  updatedAt: number;
}

const jobs = new Map<string, PrintJob>();

export function registerPendingJob(txid: string, hash: string, qrCodeBase64: string) {
  jobs.set(txid, { txid, hash, qrCodeBase64, status: "pending", updatedAt: Date.now() });
}

export function markJobResult(txid: string, success: boolean, error?: string) {
  const job = jobs.get(txid);
  if (!job) return;
  job.status = success ? "success" : "failed";
  job.error = error;
  job.updatedAt = Date.now();
}

export function getJob(txid: string): PrintJob | undefined {
  return jobs.get(txid);
}
