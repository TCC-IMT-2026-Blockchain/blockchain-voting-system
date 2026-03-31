export type UserRole = 'ELECTOR' | 'ADMIN' | 'AUDITOR';
export type ElectionStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'TALLIED' | 'ARCHIVED';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  token: string;
}

export interface Candidate {
  id: string;
  electionId: string;
  positionId: string;
  name: string;
  number: string;
  party: string | null;
  photoUrl: string | null;
}

export interface BallotPosition {
  id: string;
  title: string;
  minSelections: number;
  maxSelections: number;
  candidates: Candidate[];
}

export interface Election {
  id: string;
  title: string;
  description: string;
  status: ElectionStatus;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  positions: BallotPosition[];
}

export interface VoteReceipt {
  receiptId: string;
  electionId: string;
  receiptHash: string;
  ballotCommitment: string;
  transactionHash: string;
  status: 'PENDING' | 'ACCEPTED' | 'INCLUDED';
  issuedAt: string;
  blockNumber: number | null;
  ledgerTimestamp: string | null;
}

export interface LedgerEntry {
  id: string;
  electionId: string;
  transactionHash: string;
  receiptHash: string;
  ballotCommitment: string;
  blockNumber: number;
  timestamp: string;
}

export const users: User[] = [
  {
    id: '5b90e1ad-3e2d-4438-8a9f-1ab111111111',
    name: 'Demo Elector',
    email: 'elector@example.com',
    password: 'demo123',
    role: 'ELECTOR',
    token: 'demo-elector-token'
  },
  {
    id: '5b90e1ad-3e2d-4438-8a9f-1ab222222222',
    name: 'Demo Admin',
    email: 'admin@example.com',
    password: 'demo123',
    role: 'ADMIN',
    token: 'demo-admin-token'
  },
  {
    id: '5b90e1ad-3e2d-4438-8a9f-1ab333333333',
    name: 'Demo Auditor',
    email: 'auditor@example.com',
    password: 'demo123',
    role: 'AUDITOR',
    token: 'demo-auditor-token'
  }
];

const electionId = '2a3c4d5e-1111-4a4a-bbbb-111111111111';
const positionId = '8f7a6b5c-1111-4c4c-aaaa-222222222222';

export const elections: Election[] = [
  {
    id: electionId,
    title: 'Computer Engineering Council 2026',
    description: 'Demo election for the blockchain voting TCC project.',
    status: 'OPEN',
    startsAt: '2026-04-01T12:00:00.000Z',
    endsAt: '2026-04-15T21:00:00.000Z',
    createdAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-20T18:00:00.000Z',
    positions: [
      {
        id: positionId,
        title: 'Class Representative',
        minSelections: 1,
        maxSelections: 1,
        candidates: [
          {
            id: '10000000-0000-4000-8000-000000000010',
            electionId,
            positionId,
            name: 'Alice Johnson',
            number: '10',
            party: 'Independent',
            photoUrl: 'https://example.com/candidates/alice.jpg'
          },
          {
            id: '10000000-0000-4000-8000-000000000020',
            electionId,
            positionId,
            name: 'Bruno Martins',
            number: '20',
            party: 'Tech Future',
            photoUrl: 'https://example.com/candidates/bruno.jpg'
          },
          {
            id: '10000000-0000-4000-8000-000000000030',
            electionId,
            positionId,
            name: 'Carla Souza',
            number: '30',
            party: 'Students First',
            photoUrl: 'https://example.com/candidates/carla.jpg'
          }
        ]
      }
    ]
  }
];

export const voteReceipts: VoteReceipt[] = [
  {
    receiptId: '9d9b9f9a-1111-4222-8333-444444444444',
    electionId,
    receiptHash: '0xreceipt-hash-001',
    ballotCommitment: '0x88b73d5b4f6d2d9ab8d1e5b1f4355d2bdf9982f31ef1b2d9cb93de3d9c181111',
    transactionHash: '0xtxhash001',
    status: 'INCLUDED',
    issuedAt: '2026-04-02T15:30:00.000Z',
    blockNumber: 101,
    ledgerTimestamp: '2026-04-02T15:31:30.000Z'
  }
];

export const ledgerEntries: LedgerEntry[] = [
  {
    id: '7f7e7d7c-1111-4333-8444-555555555555',
    electionId,
    transactionHash: '0xtxhash001',
    receiptHash: '0xreceipt-hash-001',
    ballotCommitment: '0x88b73d5b4f6d2d9ab8d1e5b1f4355d2bdf9982f31ef1b2d9cb93de3d9c181111',
    blockNumber: 101,
    timestamp: '2026-04-02T15:31:30.000Z'
  }
];

export const results = [
  {
    positionId,
    positionTitle: 'Class Representative',
    candidateId: '10000000-0000-4000-8000-000000000010',
    candidateName: 'Alice Johnson',
    voteCount: 1
  },
  {
    positionId,
    positionTitle: 'Class Representative',
    candidateId: '10000000-0000-4000-8000-000000000020',
    candidateName: 'Bruno Martins',
    voteCount: 0
  },
  {
    positionId,
    positionTitle: 'Class Representative',
    candidateId: '10000000-0000-4000-8000-000000000030',
    candidateName: 'Carla Souza',
    voteCount: 0
  }
];
