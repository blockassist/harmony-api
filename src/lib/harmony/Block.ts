import { AxiosResponse } from 'axios'
import parseLog  from 'eth-log-parser'
import converter from 'bech32-converting'
import { HarmonyInternalTransaction, HarmonyTransaction, HarmonyLog, HarmonyTransactionDict, LogSummary } from '../../interfaces/harmony/Block'
import EventLog from '../../interfaces/harmony/EventLog'
import { getBlockByNum, getLogs, getInternals } from './client'
import { NullTransactionsError, WaitForBlockError, HarmonyResponseError, NoHarmonyInternals } from './HarmonyErrors'
import { getContract, topicToAddress } from './web3Client'
import erc20Abi from '../erc20Abi'
import getSignature from '../erc20Signature'
import captureException from '../captureException'

export default class Block {
  constructor(blockNum: number) {
    this.blockNum = blockNum
    this.blockHex = `0x${blockNum.toString(16)}`
  }

  public async getTransactions(): Promise<HarmonyTransactionDict> {
    await this.gatherTransactions()
    await this.combine()
    this.processInternals()

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

  private static validateResults(results: Array<AxiosResponse|null>): NullTransactionsError|WaitForBlockError|void {
    const msg = 'Response is null from Harmony Client, cannot parse transactions'
    if (results[0] === null || results[1] === null) throw new NullTransactionsError(msg);
    if (results[0]?.data?.error?.code === -32000) throw new WaitForBlockError('Wait for next block');
    if (results[0]?.data?.error != null) throw new HarmonyResponseError(results[0]?.data?.error?.message)
    if (results[1]?.data?.error != null) throw new HarmonyResponseError(results[1]?.data?.error?.message)
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
    return Block.parseValue(numValue, decimals)
  }

  private static parseValue(value: number, decimals = 18): string {
    return (value/10**decimals).toString()
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
    const asset = log?.contract?.symbol || 'ONE'
    return {
      value,
      asset,
      event: log.eventLog.event,
      from: Block.getFromLog(log),
      to: Block.getToLog(log),
    }
  }

  private static mergeAddresses(existingAddresses: string[], addtlAddresses: string[]): string[] {
    const newAddresses = [...existingAddresses, ...addtlAddresses]
    return Array.from(new Set(newAddresses)) // De-dupe and return
  }

  private async gatherTransactions(): Promise<void> {
    const results = await Promise.all([
      getBlockByNum(this.blockNum),
      getLogs(this.blockHex),
      getInternals(this.blockNum)
    ])

    Block.validateResults(results)
    this.txns = results[0].data.result.transactions
    this.txnLogs = results[1].data.result
    this.internalTxns = results[2]?.data
    console.log("*******************")
    console.log(results[2])
  }

  private async combine(): Promise<void> {
    this.transactions = {}
    for (const txn of this.txns) {  // eslint-disable-line no-restricted-syntax
      if (Block.isToFromEmpty(txn)) return;

      this.transactions[txn.hash] = txn
      const [to, from] = Block.convertHarmonyAddresses(txn)
      const parsedValue = Block.parseValue(txn.value)
      const functionName = await getSignature(txn.input.slice(0,10)) // eslint-disable-line no-await-in-loop
      const totalGas = ((txn.gasPrice * txn.gas)/10**18).toString()
      // Set basic values on transaction and initialize arrays
      Object.assign(this.transactions[txn.hash], {
        functionName,
        to,
        from,
        totalGas,
        logs: [],
        internals: [],
        addresses: [to, from],
        asset: 'ONE',
        sortField: Date.now(),
        parsedValue
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
        this.transactions[txnHash].addresses = Block.mergeAddresses(existingAddresses, topicAddresses)
      }
    }
  }

  private hasMatchingToplevel(internalTxn: HarmonyInternalTransaction): boolean {
    const txn = this.transactions[internalTxn.transactionHash]
    if (txn === undefined) return false;

    return (txn.value === parseInt(internalTxn.value, 10)) && (txn.from === internalTxn.from) && (txn.to === internalTxn.to)
  }

  private internalsPresent(): boolean {
    if (this.internalTxns != null && this.internalTxns[0]?.transactionHash != null) return true;

    const e = new NoHarmonyInternals(`BlockNum: ${this.blockNum}`)
    captureException(e)

    return false;
  }

  private processInternals(): void {
    if (!this.internalsPresent()) return;

    for (const txn of this.internalTxns) { // eslint-disable-line no-restricted-syntax
      if (txn.value === '0') continue;
      if (txn.error !== '') continue;
      if (this.hasMatchingToplevel(txn)) continue;

      if (this.transactions[txn.transactionHash]) {
        this.addInternalToTxns(txn)
      } else {
        const topLevelTxn = this.createTopLevelFromInternal(txn)
        this.transactions[topLevelTxn.hash] = topLevelTxn
      }
    }
  }

  private addInternalToTxns(txn: HarmonyInternalTransaction): void {
    const txnHash = txn.transactionHash
    this.transactions[txnHash].internals.push(txn)

    const existingAddresses = this.transactions[txnHash].addresses
    const newAddresses = [txn.to, txn.from]
    this.transactions[txnHash].addresses = Block.mergeAddresses(existingAddresses, newAddresses)
  }

  private createTopLevelFromInternal(txn: HarmonyInternalTransaction): HarmonyTransaction {
    const gas = parseInt(txn.gasUsed, 10)
    const gasPrice = parseInt(txn.gas, 10)
    const totalGas = ((gasPrice * gas)/10**18).toString()
    const parsedValue = Block.parseValue(parseInt(txn.value, 10))
    return {
      functionName: 'Internal',
      blockNumber: this.blockNum,
      from: txn.from,
      to: txn.to,
      timestamp: Date.now(),
      sortField: Date.now(),
      totalGas,
      gasPrice,
      gas,
      hash: txn.transactionHash,
      input: txn.input,
      transactionIndex: txn.index,
      value: parseInt(txn.value, 10),
      parsedValue,
      logs: [],
      internals: [],
      addresses: [txn.from, txn.to],
      asset: 'ONE'
    }
  }

  blockNum: number

  blockHex: string

  txnLogs: HarmonyLog[]

  txns: HarmonyTransaction[]

  internalTxns: HarmonyInternalTransaction[]

  transactions: HarmonyTransactionDict
}
