import { logHarmonyError } from '../firestore'
import { NullTransactionsError, WaitForBlockError, HarmonyResponseError } from '../Harmony/HarmonyErrors'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function (externalTxns: any, txnLogs: any): Promise<NullTransactionsError|WaitForBlockError|HarmonyResponseError|void> {
  const msg = 'Response is null from Harmony Client, cannot parse transactions'
  if (externalTxns === null || txnLogs === null) {
    await logHarmonyError('NullTransactionsError')
    throw new NullTransactionsError(msg)
  }

  if (externalTxns?.data?.error?.code === -32000) throw new WaitForBlockError('Wait for next block')

  if (externalTxns?.data?.error != null) {
    await logHarmonyError('HarmonyBlockResponseError')
    throw new HarmonyResponseError(externalTxns?.data?.error?.message)
  }

  if (txnLogs?.data?.error != null) {
    await logHarmonyError('HarmonyLogsResponseError')
    throw new HarmonyResponseError(txnLogs?.data?.error?.message)
  }
}
