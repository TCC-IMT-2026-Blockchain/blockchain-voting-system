import { Router } from 'express';
import { elections } from '../data/mockDb.js';
import { errorResponse, requireAuth } from './helpers.js';

export const electionsRouter = Router();

electionsRouter.get('/', requireAuth, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const filtered = status ? elections.filter((item) => item.status === status) : elections;

  res.json({
    data: filtered.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      startsAt: item.startsAt,
      endsAt: item.endsAt
    })),
    meta: {
      page: 1,
      pageSize: filtered.length,
      total: filtered.length
    }
  });
});

electionsRouter.get('/:electionId', requireAuth, (req, res) => {
  const election = elections.find((item) => item.id === req.params.electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  res.json({ data: election });
});

electionsRouter.get('/:electionId/ballot', requireAuth, (req, res) => {
  const election = elections.find((item) => item.id === req.params.electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  res.json({
    data: {
      electionId: election.id,
      title: election.title,
      positions: election.positions
    }
  });
});
