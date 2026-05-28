export type UserRole = "ELECTOR" | "ADMIN" | "AUDITOR";
export type ElectionStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "TALLIED" | "ARCHIVED";

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
  name: string;
  number: string;
  description?: string | null;
}

export interface Election {
  id: string;
  chainElectionId: string;
  title: string;
  description: string;
  status: ElectionStatus;
  startsAt: string;
  endsAt: string;
  candidates: Candidate[];
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredVoter {
  id: string;
  electionId: string;
  voterIdHash: string;
  publicKey: string;
  identityTxid: string;
  credentialRecordTxid?: string;
  voterAddress?: string;
  tokenTransferTxid?: string;
  createdAt: string;
}

export interface VoteReceipt {
  id: string;
  electionId: string;
  txid: string;
  receiptHash?: string | null;
  status: string;
  blockheight?: number | null;
  confirmations?: number | null;
  createdAt: string;
}

export interface Database {
  users: User[];
  elections: Election[];
  voters: RegisteredVoter[];
  receipts: VoteReceipt[];
}
