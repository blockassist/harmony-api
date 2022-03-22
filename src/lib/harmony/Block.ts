import { AxiosResponse } from 'axios'
import parseLog  from 'eth-log-parser'
import converter from 'bech32-converting'
import { HarmonyTransaction, HarmonyLog, HarmonyTransactionDict, LogSummary } from '../../interfaces/harmony/Block'
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

  private static convertHarmonyAddresses(txn: HarmonyTransaction): string[] {
    const to = converter('one').toHex(txn.to)
    const from = converter('one').toHex(txn.from)
    return [to.toLowerCase(), from.toLowerCase()]
  }

  private static parseLogValue(log: HarmonyLog): string {
    const decimals = Block.getLogDecimals(log)
    if (decimals === null) return '0';

    const {value} = log.eventLog.returnValues
    if (value === undefined) return '0';
    if (typeof(value) !== 'string') return '0';

    const numValue: number = parseInt(value, 10)
    return (numValue/10**decimals).toString()
  }

  private static getLogDecimals(log: HarmonyLog): number | null {
    const {contract} = log
    if (contract !== null) {
      const {decimals} = contract
      if (decimals !== null) return parseInt(decimals, 10);
      return null
    }
    return null
  }

  private static getFromLog(log: HarmonyLog): string | unknown {
    const values = log.eventLog.returnValues
    const keys = Object.keys(values)
    if (values.from !== undefined) return values.from;
    if (values.owner !== undefined) return values.owner;
    return values[keys[0]]
  }

  private static getToLog(log: HarmonyLog): string | unknown {
    const values = log.eventLog.returnValues
    const keys = Object.keys(values)
    if (values.to !== undefined) return values.to;
    if (values.spender !== undefined) return values.spender;
    return values[keys[0]]
  }

  private static summarizeLog(log: HarmonyLog): LogSummary {
    const value = Block.parseLogValue(log)
    const asset = log.contract.symbol || 'ONE'
    return {
      value,
      asset,
      event: log.eventLog.event,
      from: Block.getFromLog(log),
      to: Block.getToLog(log),
    }
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
        addresses: [to, from],
        asset: 'ONE'
      });
    }

    // Process logs and add them to main transaction object
    for (const txnLog of this.txnLogs) { // eslint-disable-line no-restricted-syntax
      const txnHash = txnLog.transactionHash

      if (this.transactions[txnHash] === null) continue;
      if (this.transactions[txnHash] === undefined) continue;

      // Convert log into human readable event data(if possible)
      txnLog.eventLog = Block.getEventLog(txnLog)
      if (txnLog.eventLog === null) continue;

      // Get info on contract if exists (token name, decimals...etc)
      txnLog.contract = await getContract(txnLog.address) // eslint-disable-line no-await-in-loop
      // Summarize Log Data
      txnLog.summary = Block.summarizeLog(txnLog)

      // Add log to Transaction
      this.transactions[txnHash].logs.push(txnLog)

      // Extract additional addresses from logs and add them to main array of addresses for the txn
      const topicAddresses = Block.addressesFromTopics(txnLog.topics)
      if (topicAddresses.length > 0) {
        const existingAddresses = this.transactions[txnHash].addresses
        let newAddresses = [...existingAddresses, ...topicAddresses]
        newAddresses = Array.from(new Set(newAddresses)) // De-dupe
        this.transactions[txnHash].addresses = newAddresses
      }

    }
  }

  blockNum: number

  blockHex: string

  txnLogs: HarmonyLog[]

  txns: HarmonyTransaction[]

  transactions: HarmonyTransactionDict
}
