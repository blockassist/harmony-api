import parseEventLog  from './parseEventLog'
import { parseValue , mergeAddresses } from './utilities'
import { getContract, topicToAddress } from '../web3Client'
import { Log, LogSummary, TransactionDict } from '../../interfaces/Block'

export default async function(transactions: TransactionDict, ethToHash: Record<string, string>, rawLog: Log):Promise<void> {
  // Find the correct hash for the log, if it doesn't exist, return to next iteration
  const txnHash = getTxnHashFromLogHash(transactions, ethToHash, rawLog.transactionHash)
  if (txnHash == null) return;

  // Convert log into human readable event data, if possible
  rawLog.eventLog = await parseEventLog(rawLog) // eslint-disable-line no-await-in-loop
  if (rawLog.eventLog === null) return;

  // Get info on contract if exists (token name, decimals...etc)
  rawLog.contract = await getContract(rawLog.address) // eslint-disable-line no-await-in-loop

  // Summarize Log Data
  rawLog.summary = summarizeLog(rawLog)

  // TODO: Wrap event specific logic into their own objects

  // For withdrawl, set TO to the contract address otherwise it looks like a self-send
  if (rawLog.summary?.event === 'Withdrawal') {
    rawLog.summary.to = rawLog.address
  }

  // For deposit, set FROM to the contract address otherwise it looks like a self-send
  if (rawLog.summary?.event === 'Deposit') {
    rawLog.summary.from = rawLog.address
  }

  // Add log to Transaction
  transactions[txnHash].logs.push(rawLog)

  // Extract additional addresses from logs and add them to main array of addresses for the txn
  const topicAddresses = addressesFromTopics(rawLog.topics)
  if (topicAddresses.length > 0) {
    const existingAddresses = transactions[txnHash].addresses
    transactions[txnHash].addresses = mergeAddresses(existingAddresses, topicAddresses)
  }
}

function getTxnHashFromLogHash(transactions: TransactionDict, ethToHash: Record<string, string>, logHash: string): string | null {
  // If there's a match external transaction for the provided hash, return it
  if (transactions[logHash] != null) return logHash;

  // See if we were passed an ETH hash, if not return null
  const txnHash = ethToHash[logHash]
  if (txnHash == null) return null;

  // Check for a matching external transaction and if so return that hash
  if (transactions[txnHash] != null) return txnHash;
  return null
}

function summarizeLog(log: Log): LogSummary {
  const value = parseLogValue(log)
  const asset = log?.contract?.symbol || 'ONE'
  return {
    value,
    asset,
    event: log.eventLog.event,
    from: extractFromTo(log, 'from'),
    to: extractFromTo(log, 'to'),
  }
}

function parseLogValue(log: Log): string {
  // Note: for wad/ray see: https://ethereum.stackexchange.com/a/87690
  const wad = log.eventLog?.returnValues?.wad
  if (wad != null && typeof(wad) === 'string' && wad !== '') return (parseInt(wad, 10)/10**18).toString();

  const ray = log.eventLog?.returnValues?.ray
  if (ray != null && typeof(ray) === 'string' && ray !== '') return (parseInt(ray, 10)/10**27).toString();

  const decimals = getLogDecimals(log)
  if (decimals === null) return '0';

  const {value} = log.eventLog.returnValues
  if (value === undefined) return '0';
  if (typeof(value) !== 'string') return '0';

  const numValue: number = parseInt(value, 10)
  return parseValue(numValue, decimals)
}

function getLogDecimals(log: Log): number | null {
  const {contract} = log
  if (contract !== null) {
    const {decimals} = contract
    if (decimals !== null) return parseInt(decimals, 10);
    return null
  }
  return null
}

function extractFromTo(log: Log, direction: string): string | unknown {
  const values = log.eventLog.returnValues
  const keys = Object.keys(values)

  if (direction === 'to') {
    if (values.to !== undefined) return values.to;
    if (values.spender !== undefined) return values.spender;
  } else {
    if (values.from !== undefined) return values.from;
    if (values.owner !== undefined) return values.owner;
  }

  return values[keys[0]]
}

function addressesFromTopics(topics: string[]): string[] {
  const addresses = []
  topics.slice(1).forEach((val) => {
    const address = topicToAddress(val)
    if (address !== null) addresses.push(address.toLowerCase());
  })
  return addresses
}
