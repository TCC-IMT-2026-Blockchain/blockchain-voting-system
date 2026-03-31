import { Router } from 'express';
import { elections, ledgerEntries, results } from '../data/mockDb.js';
import { errorResponse } from './helpers.js';

export const auditRouter = Router();

auditRouter.get('/elections/:electionId/results', (req, res) => {
  const election = elections.find((item) => item.id === req.params.electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  res.json({
    data: {
      electionId: election.id,
      status: election.status,
      publishedAt: election.status === 'TALLIED' ? new Date().toISOString() : null,
      resultHash: election.status === 'TALLIED' ? '0xresult-hash-001' : null,
      items: results
    }
  });
});

auditRouter.get('/elections/:electionId/ledger', (req, res) => {
  const election = elections.find((item) => item.id === req.params.electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const filtered = ledgerEntries.filter((entry) => entry.electionId === election.id);
  const startIndex = (page - 1) * pageSize;
  const data = filtered.slice(startIndex, startIndex + pageSize);

  res.json({
    data,
    meta: {
      page,
      pageSize,
      total: filtered.length
    }
  });
});
