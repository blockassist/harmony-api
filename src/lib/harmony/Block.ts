import converter from 'bech32-converting'
import parseEventLog  from '../parseEventLog'
import { HarmonyInternalTransaction, HarmonyTransaction, HarmonyLog, HarmonyTransactionDict, LogSummary } from '../../interfaces/harmony/Block'
import { getBlockByNum, getLogs } from './client'
import { NullTransactionsError, WaitForBlockError, HarmonyResponseError } from './HarmonyErrors'
import { getContract, topicToAddress } from './web3Client'
import getSignature from '../erc20Signature'
import { logHarmonyError } from '../firestore'
import captureException from '../captureException'
import Redis from '../Redis'

const redis = new Redis();

export default class Block {
  constructor(blockNum: number) {
    this.blockNum = blockNum
    this.blockHex = `0x${blockNum.toString(16)}`
    this.ethToHash = {}
  }

  public async getTransactions(): Promise<HarmonyTransactionDict> {
    await this.gatherTransactions()
    await this.combine()
    await this.processInternals()

    return this.transactions
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static parseInternal(txn: any): HarmonyInternalTransaction|null {
    if (!txn?.result?.gasUsed || !txn?.action?.gas) return null;

    try {
      const gas = parseInt(txn.result.gasUsed, 10)
      const gasPrice = parseInt(txn.action.gas, 10)
      const totalGas = ((gasPrice * gas)/10**18).toString()
      const value = txn.action.value ? parseInt(txn.action.value, 16): 0
      const parsedValue = Block.parseValue(value)

      return {
        index: txn.transactionPosition,
        blockNumber: txn.blockNumber,
        from: txn.action.from,
        to: txn.action.to,
        totalGas,
        gasPrice,
        gas,
        input: txn.action.input,
        output: txn.action.output,
        value,
        parsedValue,
        transactionHash: txn.transactionHash,
        time: Date.now(),
        asset: 'ONE'
      }
    } catch(e) {
      captureException(e)
      return null
    }
  }

  private static addressesFromTopics(topics: string[]): string[] {
    const addresses = []
    topics.slice(1).forEach((val) => {
      const address = topicToAddress(val)
      if (address !== null) addresses.push(address.toLowerCase());
    })
    return addresses
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async validateResults(txns: any, txnLogs: any): Promise<NullTransactionsError|WaitForBlockError|HarmonyResponseError|void> {
    const msg = 'Response is null from Harmony Client, cannot parse transactions'
    if (txns === null || txnLogs === null) {
      await logHarmonyError('NullTransactionsError')
      throw new NullTransactionsError(msg)
    }

    if (txns?.data?.error?.code === -32000) throw new WaitForBlockError('Wait for next block')

    if (txns?.data?.error != null) {
      await logHarmonyError('HarmonyBlockResponseError')
      throw new HarmonyResponseError(txns?.data?.error?.message)
    }

    if (txnLogs?.data?.error != null) {
      await logHarmonyError('HarmonyLogsResponseError')
      throw new HarmonyResponseError(txnLogs?.data?.error?.message)
    }
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
    // Note: for wad/ray see: https://ethereum.stackexchange.com/a/87690
    const wad = log.eventLog?.returnValues?.wad
    if (wad != null && typeof(wad) === 'string' && wad !== '') return (parseInt(wad, 10)/10**18).toString();

    const ray = log.eventLog?.returnValues?.ray
    if (ray != null && typeof(ray) === 'string' && ray !== '') return (parseInt(ray, 10)/10**27).toString();

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

  private static createTopLevelFromInternal(txn: HarmonyInternalTransaction): HarmonyTransaction {
    return {
      functionName: txn.event,
      blockNumber: txn.blockNumber,
      from: txn.from,
      to: txn.to,
      timestamp: Date.now(),
      sortField: Date.now(),
      totalGas: txn.totalGas,
      gasPrice: txn.gasPrice,
      gas: txn.gas,
      hash: txn.transactionHash,
      input: txn.input,
      transactionIndex: txn.index,
      value: txn.value,
      parsedValue: txn.parsedValue,
      logs: [],
      internals: [],
      addresses: [txn.from, txn.to],
      asset: 'ONE'
    }
  }

  private async gatherTransactions(): Promise<void> {
    const results = await Promise.all([
      getBlockByNum(this.blockNum),
      getLogs(this.blockHex),
      Block.getInternals(this.blockNum)
    ])

    await Block.validateResults(results[0], results[1])
    this.txns = results[0].data.result.transactions
    this.txnLogs = results[1].data.result
    this.internalTxns = results[2] // eslint-disable-line prefer-destructuring
  }

  private static async getInternals(blockNum: number): Promise<HarmonyInternalTransaction[]> {
    const result = await redis.getAsync(`internal-${blockNum}`)
    if (result === null) return [];

    return JSON.parse(result);
  }

  private async combine(): Promise<void> {
    this.transactions = {}
    for (const txn of this.txns) {  // eslint-disable-line no-restricted-syntax
      if (Block.isToFromEmpty(txn)) return;

      this.transactions[txn.hash] = txn
      this.ethToHash[txn.ethHash] = txn.hash // map the ethHash to the TxnHash
      const [to, from] = Block.convertHarmonyAddresses(txn)
      const parsedValue = Block.parseValue(txn.value)
      const functionName = await Block.getFunctionName(txn.input) // eslint-disable-line no-await-in-loop
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

      // Convert log into human readable event data, if possible
      txnLog.eventLog = await parseEventLog(txnLog) // eslint-disable-line no-await-in-loop
      if (txnLog.eventLog === null) continue;

      // Get info on contract if exists (token name, decimals...etc)
      txnLog.contract = await getContract(txnLog.address) // eslint-disable-line no-await-in-loop

      // Summarize Log Data
      txnLog.summary = Block.summarizeLog(txnLog)

      // Update External Txn Value if Withdrawal
      if (txnLog?.summary?.event === 'Withdrawal' &&
          this.transactions[txnHash]?.parsedValue === '0') {
          this.transactions[txnHash].parsedValue = txnLog.summary.value
      }

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
    const matchingHash = this.ethToHash[internalTxn.transactionHash]
    if (matchingHash === undefined) return false;

    return this.transactions[matchingHash] === undefined
  }

  private isDuplicateToplevel(internalTxn: HarmonyInternalTransaction): boolean {
    const matchingHash = this.ethToHash[internalTxn.transactionHash]
    if (matchingHash === undefined) return false;

    const txn = this.transactions[matchingHash]
    if (txn === undefined) return false;

    return (txn.value === internalTxn.value) && (txn.from === internalTxn.from) && (txn.to === internalTxn.to)
  }

  private static async getFunctionName(input: string|null|undefined): Promise<string|null> {
    if (!input) return null;

    const contractAddress = input.slice(0,10)
    return getSignature(contractAddress)
  }

  private async processInternals(): Promise<void> {
    if (this.internalTxns.length === 0) return;

    for (const txn of this.internalTxns) { // eslint-disable-line no-restricted-syntax
      if (this.isDuplicateToplevel(txn)) continue;

      txn.event = await Block.getFunctionName(txn?.input) || 'Internal' // eslint-disable-line no-await-in-loop


      if (this.hasMatchingToplevel(txn)) {
        this.addInternalToTxns(txn)
      } else {
        const topLevelTxn = Block.createTopLevelFromInternal(txn)
        this.transactions[topLevelTxn.hash] = topLevelTxn
      }
    }
  }

  private addInternalToTxns(txn: HarmonyInternalTransaction): void {
    const txnHash = this.ethToHash[txn.transactionHash]
    this.transactions[txnHash].internals.push(txn)

    const existingAddresses = this.transactions[txnHash].addresses
    const newAddresses = [txn.to, txn.from]
    this.transactions[txnHash].addresses = Block.mergeAddresses(existingAddresses, newAddresses)
  }

  ethToHash: Record<string, string>

  blockNum: number

  blockHex: string

  txnLogs: HarmonyLog[]

  txns: HarmonyTransaction[]

  internalTxns: HarmonyInternalTransaction[]

  transactions: HarmonyTransactionDict
}
