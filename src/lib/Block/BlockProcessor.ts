import { TransactionDict, Transaction } from '../../interfaces/Block'
import { getSubscribedAddresses, batchCreateTransactions } from '../firestore'
import TransactionAssembler from './TransactionAssembler'
import Redis from '../Redis'

let redis;

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
    const assembler = new TransactionAssembler(this.blockNum, 'Harmony')
    this.transactions = await assembler.assembleTransactions()
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
    const result = await BlockProcessor.redisClient().getAsync(key)
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

  private static redisClient(): Redis {
    if (redis) return redis;
    redis = new Redis()
    return redis
  }

  transactions: TransactionDict

  relevantTransactions: Transaction[]

  blockNum: number
}
