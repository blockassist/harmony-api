import EventLog from './EventLog'
import Contract from './Contract'

interface LogSummary {
  event: string;
  value: string;
  asset: string;
  from: string | unknown;
  to: string | unknown;
}

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
  contract?: Contract;
  eventLog?: EventLog;
  summary?: LogSummary;
}

interface HarmonyTransaction {
  functionName?: string | null;
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
  addresses?: string[];
  asset: string;
}

interface HarmonyTransactionDict {
  [key : string]: HarmonyTransaction;
}

export { HarmonyTransaction, HarmonyLog, HarmonyTransactionDict, LogSummary }
