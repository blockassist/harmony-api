import BlockProcessor from './BlockProcessor'
import { getlastBlockNumber, updateLastBlockNumber } from '../firestore'
import { WaitForBlockError } from './HarmonyErrors'
import captureException from '../captureException'
import Redis from '../Redis'

let redis;

export default async function (): Promise<void> {
  try {
    const currentBlockNumber = await getNextBlockNumber()
    await processBlock(currentBlockNumber)
    await updateLastBlockNumber(currentBlockNumber)
    console.log(`Successfully processed Block: ${currentBlockNumber}`)
  } catch(e) {
    if (e instanceof WaitForBlockError) return;
    await reportError(e);
  }
}

async function processBlock(blockNumber: number): Promise<void> {
  const processor = new BlockProcessor(blockNumber)
  return processor.call()
}

async function getNextBlockNumber(): Promise<number> {
  const result = await getlastBlockNumber()
  if (result === null) throw new Error('LastBlockNumber from Firebase is null');

  return (result + 1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reportError(e: any): Promise<void> {
  // This function rate limits sending the same error to sentry every 1 min
  const key = e.toString().substring(0,25)
  const result = await redisClient().getAsync(key)
  if (result !== null) return;

  captureException(e)
  await redisClient().setExAsync(key, '1', 60)
}

function redisClient(): Redis {
  if (redis) return redis;
  redis = new Redis()
  return redis
}
