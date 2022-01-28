interface HarmonyLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}

interface HarmonyTransaction {
  blockHash: string;
  blockNumber: number;
  from: string;
  timestamp: number;
  gas: number;
  gasPrice: number;
  hash: string;
  ethHash: string;
  input: string | null;
  nonce: number;
  to: string;
  transactionIndex: number;
  value: number;
  shardID: number;
  toShardID: number;
  v: string;
  r: string;
  s: string;
  logs: HarmonyLog[];
}

interface HarmonyTransactionDict {
  [key : string]: HarmonyTransaction;
}

export { HarmonyTransaction, HarmonyLog, HarmonyTransactionDict }
