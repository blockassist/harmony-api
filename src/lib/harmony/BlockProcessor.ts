import { HarmonyTransactionDict, HarmonyTransaction } from '../../interfaces/harmony/Block'
import { getSubscribedAddresses, batchCreateTransactions } from '../firestore'
import Block from './Block'
import Redis from '../Redis'

const redis = new Redis();

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
    const subscribedAddresses = await BlockProcessor.getAddresses()
    const keys = Object.keys(this.transactions)
    keys.forEach((key) => {
      const txn = this.transactions[key]
      const match = txn.addresses.find((addy) => !!subscribedAddresses.includes(addy))
      if (match) this.relevantTransactions.push(txn);
    })
  }

  private static async getAddresses(): Promise<string[]> {
    const key = 'subscribed-addresses'
    const result = await redis.getAsync(key)
    if (result != null) console.log('Addresses returned from Redis');
    if (result != null) return JSON.parse(result);

    const subscribedAddresses = await getSubscribedAddresses()
    const json = JSON.stringify(subscribedAddresses)
    redis.setExAsync(key, json, 30)

    console.log('Addresses returned from Firebase')
    return subscribedAddresses
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
