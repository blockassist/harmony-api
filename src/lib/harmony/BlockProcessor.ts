import { HarmonyTransactionDict, HarmonyTransaction } from '../../interfaces/harmony/Block'
import { getSubscribedAddresses, batchCreateTransactions } from '../firestore'
import Block from './Block'

export default class BlockProcessor {
  constructor(blockNum: number) {
    this.blockNum = blockNum
    this.relevantTransactions = []
  }

  public async call(): Promise<void> {
    await this.getAllTransactions()
    await this.findRelevantTransactions()
    await this.uploadMatches()
  }

  private async getAllTransactions(): Promise<void> {
    const block = new Block(this.blockNum)
    this.transactions = await block.getTransactions()
  }

  private async findRelevantTransactions(): Promise<void> {
    const subscribedAddresses = await getSubscribedAddresses()
    const keys = Object.keys(this.transactions)
    keys.forEach((key) => {
      const txn = this.transactions[key]
      const match = txn.addresses.find((addy) => !!subscribedAddresses.includes(addy))
      if (match) this.relevantTransactions.push(txn);
    })
  }

  private async uploadMatches(): Promise<void> {
    if (this.relevantTransactions.length < 1) return;
    const success = await batchCreateTransactions(this.relevantTransactions)
    if (success) return;
    throw new Error('Could not successfully upload matches')
  }

  transactions: HarmonyTransactionDict

  relevantTransactions: HarmonyTransaction[]

  blockNum: number
}
