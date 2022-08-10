import captureException from '../captureException'
import { InternalTransaction } from '../../interfaces/Block'
import { parseValue } from './utilities'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (txn: any): InternalTransaction|null {
  if (!txn?.result?.gasUsed || !txn?.action?.gas) return null;

  try {
    const gas = parseInt(txn.result.gasUsed, 10)
    const gasPrice = parseInt(txn.action.gas, 10)
    const totalGas = ((gasPrice * gas)/10**18).toString()
    const value = txn.action.value ? parseInt(txn.action.value, 16): 0
    const parsedValue = parseValue(value)

    return {
      index: txn.transactionPosition,
      blockNumber: txn.blockNumber,
      from: txn.action.from,
      to: txn.action.to,
      totalGas,
      gasPrice,
      gas,
      input: txn.action.input,
      output: txn.action.output,
      value,
      parsedValue,
      transactionHash: txn.transactionHash,
      time: Date.now(),
      asset: 'ONE'
    }
  } catch(e) {
    captureException(e)
    return null
  }
}
