import { AxiosResponse } from 'axios'
import parseLog  from 'eth-log-parser'
import converter from 'bech32-converting'
import { HarmonyTransaction, HarmonyLog, HarmonyTransactionDict } from '../../interfaces/harmony/Block'
import EventLog from '../../interfaces/harmony/EventLog'
import { getBlockByNum, getLogs } from './client'
import { NullTransactionsError } from './HarmonyErrors'
import { getContract, topicToAddress } from './web3Client'
import erc20Abi from '../erc20Abi'
import getSignature from '../erc20Signature'

export default class Block {
  constructor(blockNum: number) {
    this.blockNum = blockNum
    this.blockHex = `0x${blockNum.toString(16)}`
  }

  public async getTransactions(): Promise<HarmonyTransactionDict> {
    await this.gatherTransactions()
    await this.combine()
    return this.transactions
  }

  private static addressesFromTopics(topics: string[]): string[] {
    const addresses = []
    topics.slice(1).forEach((val) => {
      const address = topicToAddress(val)
      if (address !== null) addresses.push(address.toLowerCase());
    })
    return addresses
  }

  private static getEventLog(log: HarmonyLog): EventLog|null {
    try {
      return parseLog(log, erc20Abi);
    } catch {
      return null
    }
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

  private async combine(): Promise<void> {
    this.transactions = {}
    this.txns.forEach(async (txn) => {
      this.transactions[txn.hash] = txn

      // Convert harmony addres (one3Fc3h02...) to hex address (0x2fca..)
      const [to, from] = [converter('one').toHex(txn.to), converter('one').toHex(txn.from)]
      // Extracts function signature from transaction
      const functionName = await getSignature(txn.input.slice(0,10))

      // Set basic values on transaction and initialize arrays
      this.transactions[txn.hash].functionName = functionName
      this.transactions[txn.hash].to = to.toLowerCase()
      this.transactions[txn.hash].from = from.toLowerCase()
      this.transactions[txn.hash].logs = []
      this.transactions[txn.hash].addresses = []
      this.transactions[txn.hash].addresses.push(this.transactions[txn.hash].to)
      this.transactions[txn.hash].addresses.push(this.transactions[txn.hash].from)
    })

    // Process logs and add them to main transaction object
    for (const txnLog of this.txnLogs) { // eslint-disable-line no-restricted-syntax
      if (this.transactions[txnLog.transactionHash] === null) continue;
      if (this.transactions[txnLog.transactionHash] === undefined) continue;

      // Convert log into human readable event data(if possible)
      txnLog.eventLog = Block.getEventLog(txnLog)
      if (txnLog.eventLog === null) continue;

      // Get info on contract if exists (token name, decimals...etc)
      txnLog.contract = await getContract(txnLog.address) // eslint-disable-line no-await-in-loop
      this.transactions[txnLog.transactionHash].logs.push(txnLog)

      // Extract additional addresses from logs and add them to main array of addresses for the txn
      const topicAddresses = Block.addressesFromTopics(txnLog.topics)
      if (topicAddresses.length > 0) {
        const existingAddresses = this.transactions[txnLog.transactionHash].addresses
        let newAddresses = [...existingAddresses, ...topicAddresses]
        newAddresses = Array.from(new Set(newAddresses)) // De-dupe
        this.transactions[txnLog.transactionHash].addresses = newAddresses
      }
    }
  }

  blockNum: number

  blockHex: string

  txnLogs: HarmonyLog[]

  txns: HarmonyTransaction[]

  transactions: HarmonyTransactionDict
}
