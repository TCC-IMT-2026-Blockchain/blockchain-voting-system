import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3333),
  apiPrefix: "/api/v1",
  blockchainDir:
    process.env.BLOCKCHAIN_DIR ??
    path.resolve(process.cwd(), "..", "blockchain"),
  cpfSecret: process.env.CPF_SECRET ?? "segredo-da-eleicao",
  defaultChainElectionId: process.env.CHAIN_ELECTION_ID ?? "ELEICAO_001"
};
