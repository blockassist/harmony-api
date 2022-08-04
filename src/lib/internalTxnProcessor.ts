import { nextBlockNum, getInternals } from './harmony/client'
import { HarmonyInternalTransaction } from '../interfaces/harmony/Block'
import captureException from './captureException'
import Redis from './Redis'
import Block from './harmony/Block'

let redis;
const MAX_CALLS = 10 // Total number of blocks to request internal txns for at a time
const EXPIRE = 7200 // 2-hours

export default async function call(): Promise<void> {
  const blockNums = await blocksToProcess()
  if (blockNums.length === 0) return;
  console.log(`Processing Internals for Blocks ${blockNums}`)
  
  const promises = blockNums.map((blockNum) => {
    const blockHex = `0x${blockNum.toString(16)}`
    return getInternals(blockHex).then(async (response) => {
      await processInternalTxns(response, blockNum)
      console.log(`Processed Internal Txns for Block: ${blockNum}`)
    }).catch(captureException)
  })

  await Promise.all(promises)
  console.log(`Finished processing internals for Blocks ${blockNums}`)
}

async function blocksToProcess(): Promise<number[]> {
  // Gets current block we are processing and newest block, i.e. 21200 & 21235
  // Gets all the block numbers in-between those two
  // Removes any block numbers that we already have internal data for
  // And returns a slice (MAX_CALLS) of block numbers we should process

  try {
    const currentBlockNumber = await getCurrentBlockNum()
    const nextBlock = await nextBlockNum()

    if (!currentBlockNumber || !nextBlock) return [];

    const upcomingBlocks = range(currentBlockNumber, nextBlock)
    const completedBlocks = await getCompletedBlockNums()

    const completed = new Set(completedBlocks)
    const difference = [...new Set(upcomingBlocks.filter(x => !completed.has(x)))];

    return difference.slice(0, MAX_CALLS)
  } catch(e) {
    captureException(e)
    return []
  }
}

async function getCurrentBlockNum(): Promise<number|null> {
  const blockNum = await redisClient().getAsync('currentBlockNum')
  if (!blockNum) return null;
  return parseInt(blockNum, 10)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processInternalTxns(response: any, blockNum: number): Promise<void|null> {
  if (response === null) return null;
  const internalTxns = []
  response.data.result.forEach((i) => {
    const txn = Block.parseInternal(i)
    if (txn !== null && txn.parsedValue !== '0') internalTxns.push(txn);
  })

  if (internalTxns.length === 0) return cacheInternalTxns([], blockNum);

  return cacheInternalTxns(internalTxns, blockNum)
}

function cacheInternalTxns(txns: HarmonyInternalTransaction[], blockNum: number): void {
  const json = JSON.stringify(txns)
  redisClient().setExAsync(`internal-${blockNum}`, json, EXPIRE)
}

async function getCompletedBlockNums(): Promise<number[]> {
  const keys = await redisClient().getKeys('internal-*')
  if (keys === null) return [];

  return keys.map((key) => {
    const blockNum = key.replace('internal-', '')
    return parseInt(blockNum, 10)
  })
}

function range(start: number, stop: number): number[] {
  const step = 1
  return Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step))
}

function redisClient(): Redis {
  if (redis) return redis;
  redis = new Redis()
  return redis
}
