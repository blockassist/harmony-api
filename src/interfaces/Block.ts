import EventLog from './EventLog'
import Contract from './Contract'

interface LogSummary {
  event: string;
  value: string;
  asset: string;
  from: string | unknown;
  to: string | unknown;
}

interface Log {
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

interface Transaction {
  functionName?: string | null;
  blockHash?: string;
  blockNumber: number;
  from: string;
  timestamp: number;
  gas: number;
  gasPrice: number;
  totalGas: string;
  hash: string;
  ethHash?: string;
  input: string | null;
  nonce?: number;
  to: string;
  transactionIndex: number;
  value: number;
  parsedValue?: string;
  shardID?: number;
  toShardID?: number;
  v?: string;
  r?: string;
  s?: string;
  logs: Log[];
  internals?: InternalTransaction[]
  addresses?: string[];
  asset: string;
  sortField?: number;
}

interface InternalTransaction {
  index: number;
  blockNumber: number;
  from: string;
  to: string;
  gas: number;
  gasPrice: number;
  totalGas: string;
  input: string;
  output: string;
  value: number;
  parsedValue: string;
  transactionHash: string;
  asset: string;
  event?: string|null
  time: number | string | null;
}

interface TransactionDict {
  [key : string]: Transaction;
}

export { Transaction, Log, TransactionDict, LogSummary, InternalTransaction }
