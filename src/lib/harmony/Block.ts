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

  private static isToFromEmpty(txn: HarmonyTransaction): boolean {
    if (txn.to === '' || txn.to === null) return true;
    if (txn.from === '' || txn.from === null) return true;
    return false
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

  private static convertHarmonyAddresses(txn: HarmonyTransaction): string[] {
    const to = converter('one').toHex(txn.to)
    const from = converter('one').toHex(txn.from)
    return [to.toLowerCase(), from.toLowerCase()]
  }

  private async combine(): Promise<void> {
    this.transactions = {}
    for (const txn of this.txns) {  // eslint-disable-line no-restricted-syntax
      if (Block.isToFromEmpty(txn)) return;
      this.transactions[txn.hash] = txn
      const [to, from] = Block.convertHarmonyAddresses(txn)
      const functionName = await getSignature(txn.input.slice(0,10)) // eslint-disable-line no-await-in-loop

      // Set basic values on transaction and initialize arrays
      Object.assign(this.transactions[txn.hash], {
        functionName,
        to,
        from,
        logs: [],
        addresses: [to, from]
      });
    }

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
