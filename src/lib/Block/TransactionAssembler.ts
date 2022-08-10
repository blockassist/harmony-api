import validateHarmonyResponse from './harmonyResponseValidator'
import { InternalTransaction, Transaction, Log, TransactionDict } from '../../interfaces/Block'
import { getExternals, getLogs, getCachedInternals } from '../Harmony/client'
import parseExternal from './parseExternal'
import parseLog from './parseLog'
import addInternalsToTxns from './addInternalsToTxns'

export default class TransactionAssembler {
  constructor(blockNum: number, chain: string) {
    this.blockNum = blockNum
    this.blockHex = `0x${blockNum.toString(16)}`
    this.ethToHash = {}
    this.transactions = {}
    this.chain = chain
  }

  public async assembleTransactions(): Promise<TransactionDict> {
    this.setAssetName()
    await this.gatherTransactions()
    await this.parseExternals()
    await this.parseLogs()
    await this.processInternals()

    return this.transactions
  }

  private async gatherTransactions(): Promise<void> {
    const results = await Promise.all([
      getExternals(this.blockNum),
      getLogs(this.blockHex),
      getCachedInternals(this.blockNum),
    ])

    await validateHarmonyResponse(results[0], results[1])
    this.txns = results[0].data.result.transactions
    this.txnLogs = results[1].data.result
    this.internalTxns = results[2] // eslint-disable-line prefer-destructuring
  }

  private async parseExternals(): Promise<void> {
    const externals = this.txns.map((txn) => parseExternal(this.transactions, this.ethToHash, txn, this.assetName))
    await Promise.all(externals)
  }

  private async parseLogs(): Promise<void> {
    const logs = this.txnLogs.map((log) => parseLog(this.transactions, this.ethToHash, log))
    await Promise.all(logs)
  }

  private async processInternals(): Promise<void> {
    if (this.internalTxns.length === 0) return;

    const internals = this.internalTxns.map((internal) => addInternalsToTxns(this.transactions, this.assetName, this.ethToHash, internal))
    await Promise.all(internals)
  }

  public setAssetName(): void {
    if (this.chain === 'Harmony') this.assetName = 'ONE';
    if (this.chain === 'Ethereum') this.assetName = 'ETH';
  }

  ethToHash: Record<string, string>

  blockNum: number

  blockHex: string

  txns: Transaction[]

  txnLogs: Log[]

  internalTxns: InternalTransaction[]

  transactions: TransactionDict

  chain: string

  assetName: string
}
