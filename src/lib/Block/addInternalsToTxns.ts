import { InternalTransaction, Transaction, TransactionDict } from '../../interfaces/Block'
import { getFunctionName, mergeAddresses } from './utilities'

export default async function(transactions: TransactionDict, assetName: string, ethToHash: Record<string, string>, internalTxn: InternalTransaction): Promise<void> {
  if (isDuplicateToplevel(transactions, ethToHash, internalTxn)) return;

  internalTxn.event = await getFunctionName(internalTxn?.input) || 'Internal'

  if (hasMatchingToplevel(ethToHash, transactions, internalTxn)) {
    addToTxns(transactions, ethToHash, internalTxn)
    return
  }

  transactions[internalTxn.transactionHash] = createTopLevel(internalTxn, assetName)
}

function isDuplicateToplevel(transactions: TransactionDict, ethToHash: Record <string, string>, internalTxn: InternalTransaction): boolean {
  const matchingHash = ethToHash[internalTxn.transactionHash]
  if (matchingHash === undefined) return false;

  const txn = transactions[matchingHash]
  if (txn === undefined) return false;

  return (txn.value === internalTxn.value) && (txn.from === internalTxn.from) && (txn.to === internalTxn.to)
}

function hasMatchingToplevel(ethToHash: Record<string, string>, transactions: TransactionDict, internalTxn: InternalTransaction): boolean {
  const matchingHash = ethToHash[internalTxn.transactionHash]
  if (matchingHash === undefined) return false;

  return transactions[matchingHash] !== undefined
}

function addToTxns(transactions: TransactionDict, ethToHash: Record<string, string>, txn: InternalTransaction): void {
  const txnHash = ethToHash[txn.transactionHash]
  transactions[txnHash].internals.push(txn)

  const existingAddresses = transactions[txnHash].addresses
  const newAddresses = [txn.to, txn.from]
  transactions[txnHash].addresses = mergeAddresses(existingAddresses, newAddresses)
}

function createTopLevel(txn: InternalTransaction, asset: string|null): Transaction {
  return {
    functionName: txn.event,
    blockNumber: txn.blockNumber,
    from: txn.from,
    to: txn.to,
    timestamp: Date.now(),
    sortField: Date.now(),
    totalGas: txn.totalGas,
    gasPrice: txn.gasPrice,
    gas: txn.gas,
    hash: txn.transactionHash,
    input: txn.input,
    transactionIndex: txn.index,
    value: txn.value,
    parsedValue: txn.parsedValue,
    logs: [],
    internals: [],
    addresses: [txn.from, txn.to],
    asset
  }
}
