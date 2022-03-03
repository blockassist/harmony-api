interface Raw {
  data: string;
  topics: string[];
}

export default interface EventLog {
  event: string;
  signature: string;
  address: string;
  blockHash: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  raw: Raw;
  returnValues: Record<string,unknown>;
}
