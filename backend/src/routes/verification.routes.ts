import { Router } from 'express';
import { voteReceipts } from '../data/mockDb.js';
import { errorResponse } from './helpers.js';

export const verificationRouter = Router();

verificationRouter.get('/receipts/:receiptId', (req, res) => {
  const receipt = voteReceipts.find((item) => item.receiptId === req.params.receiptId);

  if (!receipt) {
    return errorResponse(res, 404, 'RECEIPT_NOT_FOUND', 'Receipt not found.');
  }

  res.json({
    data: {
      receiptId: receipt.receiptId,
      verified: true,
      inclusionStatus: receipt.status,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      ledgerTimestamp: receipt.ledgerTimestamp
    }
  });
});
