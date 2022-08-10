import converter from 'bech32-converting'
import { parseValue , getFunctionName } from './utilities'
import { Transaction, TransactionDict } from '../../interfaces/Block'

export default async function (transactions: TransactionDict, ethToHash: Record<string, string>, txn: Transaction, chain: string): Promise<void> {
  if (toFromIsEmpty(txn)) return;

  transactions[txn.hash] = txn
  ethToHash[txn.ethHash] = txn.hash

  const [to, from] = convertHarmonyAddresses(txn)
  const parsedValue = parseValue(txn.value)
  const functionName = await getFunctionName(txn.input) // eslint-disable-line no-await-in-loop
  const totalGas = ((txn.gasPrice * txn.gas)/10**18).toString()

   Object.assign(transactions[txn.hash], {
    functionName,
    to,
    from,
    totalGas,
    logs: [],
    internals: [],
    addresses: [to, from],
    asset: chain,
    sortField: Date.now(),
    parsedValue
  });
}

function toFromIsEmpty(txn: Transaction): boolean {
  if (txn.to === '' || txn.to === null) return true;
  if (txn.from === '' || txn.from === null) return true;
  return false
}

function convertHarmonyAddresses(txn: Transaction): string[] {
  const to = converter('one').toHex(txn.to)
  const from = converter('one').toHex(txn.from)
  return [to.toLowerCase(), from.toLowerCase()]
}
