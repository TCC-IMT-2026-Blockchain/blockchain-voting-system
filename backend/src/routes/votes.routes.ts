import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { elections, ledgerEntries, voteReceipts } from '../data/mockDb.js';
import { errorResponse, requireAuth } from './helpers.js';

export const votesRouter = Router();

votesRouter.post('/', requireAuth, (req, res) => {
  const { electionId, selections, encryptedBallot, ballotCommitment, nullifier } = req.body ?? {};

  if (!electionId || !Array.isArray(selections) || selections.length === 0 || !encryptedBallot || !ballotCommitment || !nullifier) {
    return errorResponse(res, 400, 'VOTE_INVALID_PAYLOAD', 'Invalid vote submission payload.');
  }

  const election = elections.find((item) => item.id === electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  if (election.status !== 'OPEN') {
    return errorResponse(res, 400, 'ELECTION_NOT_OPEN', 'Election is not open for voting.');
  }

  const duplicate = voteReceipts.find((item) => item.electionId === electionId && item.ballotCommitment === ballotCommitment);
  if (duplicate) {
    return errorResponse(res, 409, 'VOTE_DUPLICATE', 'Duplicate vote detected.');
  }

  const receiptId = randomUUID();
  const transactionHash = `0xtx${Date.now().toString(16)}`;
  const receiptHash = `0xreceipt${Date.now().toString(16)}`;
  const issuedAt = new Date().toISOString();

  const receipt = {
    receiptId,
    electionId,
    receiptHash,
    ballotCommitment,
    transactionHash,
    status: 'INCLUDED' as const,
    issuedAt,
    blockNumber: 102,
    ledgerTimestamp: issuedAt
  };

  voteReceipts.push(receipt);
  ledgerEntries.push({
    id: randomUUID(),
    electionId,
    transactionHash,
    receiptHash,
    ballotCommitment,
    blockNumber: 102,
    timestamp: issuedAt
  });

  res.status(201).json({
    data: {
      receiptId,
      electionId,
      receiptHash,
      ballotCommitment,
      transactionHash,
      status: 'INCLUDED'
    }
  });
});

votesRouter.get('/receipts/:receiptId', requireAuth, (req, res) => {
  const receipt = voteReceipts.find((item) => item.receiptId === req.params.receiptId);

  if (!receipt) {
    return errorResponse(res, 404, 'RECEIPT_NOT_FOUND', 'Receipt not found.');
  }

  res.json({ data: receipt });
});
