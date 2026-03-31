import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { elections } from '../data/mockDb.js';
import { errorResponse, requireAdmin, requireAuth } from './helpers.js';

export const adminRouter = Router();

adminRouter.post('/elections', requireAuth, requireAdmin, (req, res) => {
  const { title, description, startsAt, endsAt, positions } = req.body ?? {};

  if (!title || !description || !startsAt || !endsAt || !Array.isArray(positions) || positions.length === 0) {
    return errorResponse(res, 400, 'ELECTION_INVALID_PAYLOAD', 'Missing required election fields.');
  }

  const createdAt = new Date().toISOString();
  const electionId = randomUUID();
  const newElection = {
    id: electionId,
    title,
    description,
    status: 'DRAFT' as const,
    startsAt,
    endsAt,
    createdAt,
    updatedAt: createdAt,
    positions: positions.map((position: { title: string; minSelections: number; maxSelections: number }) => ({
      id: randomUUID(),
      title: position.title,
      minSelections: position.minSelections,
      maxSelections: position.maxSelections,
      candidates: []
    }))
  };

  elections.push(newElection);
  res.status(201).json({ data: newElection });
});

adminRouter.patch('/elections/:electionId', requireAuth, requireAdmin, (req, res) => {
  const election = elections.find((item) => item.id === req.params.electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  const { title, description, status, startsAt, endsAt } = req.body ?? {};

  if (title) election.title = title;
  if (description) election.description = description;
  if (status) election.status = status;
  if (startsAt) election.startsAt = startsAt;
  if (endsAt) election.endsAt = endsAt;
  election.updatedAt = new Date().toISOString();

  res.json({ data: election });
});

adminRouter.post('/elections/:electionId/candidates', requireAuth, requireAdmin, (req, res) => {
  const election = elections.find((item) => item.id === req.params.electionId);

  if (!election) {
    return errorResponse(res, 404, 'ELECTION_NOT_FOUND', 'Election not found.');
  }

  const { positionId, name, number, party, photoUrl } = req.body ?? {};
  const position = election.positions.find((item) => item.id === positionId);

  if (!position) {
    return errorResponse(res, 404, 'POSITION_NOT_FOUND', 'Position not found for this election.');
  }

  if (!name || !number) {
    return errorResponse(res, 400, 'CANDIDATE_INVALID_PAYLOAD', 'Candidate name and number are required.');
  }

  const candidate = {
    id: randomUUID(),
    electionId: election.id,
    positionId,
    name,
    number,
    party: party ?? null,
    photoUrl: photoUrl ?? null
  };

  position.candidates.push(candidate);
  election.updatedAt = new Date().toISOString();

  res.status(201).json({ data: candidate });
});
