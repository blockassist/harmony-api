import { AxiosResponse } from 'axios'
import { HarmonyTransaction, HarmonyLog, HarmonyTransactionDict } from '../../interfaces/harmony/Block'
import { getBlockByNum, getLogs } from './client'
import { NullTransactionsError } from './HarmonyErrors'

export default class Block {
  constructor(blockNum: number) {
    this.blockNum = blockNum
    this.blockHex = `0x${blockNum.toString(16)}`
  }

  public async getTransactions(): Promise<HarmonyTransactionDict> {
    await this.gatherTransactions()
    this.combine()
    return this.transactions
  }

  private static validateResults(results: Array<AxiosResponse|null>): NullTransactionsError|void {
    const msg = 'Response is null from Harmony Client, cannot parse transactions'
    if (results[0] === null || results[1] === null) throw new NullTransactionsError(msg)
  }

  private async gatherTransactions(): Promise<void> {
    const results = await Promise.all([
      getBlockByNum(this.blockNum),
      getLogs(this.blockHex)
    ])

    Block.validateResults(results)

    this.txns = results[0].data.result.transactions
    this.txnLogs = results[1].data.result
  }

  private combine(): void {
    this.transactions = {}
    this.txns.forEach((txn) => {
      this.transactions[txn.hash] = txn
      this.transactions[txn.hash].logs = []
    })

    this.txnLogs.forEach((txnLog) => { this.transactions[txnLog.transactionHash].logs.push(txnLog) })
  }

  blockNum: number

  blockHex: string

  txnLogs: HarmonyLog[]

  txns: HarmonyTransaction[]

  transactions: HarmonyTransactionDict
}
