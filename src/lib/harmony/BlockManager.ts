import BlockProcessor from './BlockProcessor'
import { getlastBlockNumber, setLastBlockNumber } from '../BlockNumber'
import { nextBlockNum } from './client'
import { WaitForBlockError } from './HarmonyErrors'
import captureException from '../captureException'
import wait from '../wait'
import Redis from '../Redis'

let redis;

export default async function (): Promise<void> {
  try {
    const currentBlockNumber = await getNextBlockNumber()
    redisClient().setAsync('currentBlockNum', currentBlockNumber.toString())

    if (await shouldWait(currentBlockNumber)) {
      await wait(2)
      return
    }

    await processBlock(currentBlockNumber)
    await setLastBlockNumber(currentBlockNumber)
    await redisClient().del(`internal-currentBlockNumber`)
    console.log(`Successfully processed Block: ${currentBlockNumber}`)
  } catch(e) {
    if (e instanceof WaitForBlockError) return;
    await reportError(e);
  }
}

async function shouldWait(currentBlockNumber): Promise<boolean> {
  const nextBlock = await nextBlockNum()
  if (nextBlock === null) return true;

  const distance = nextBlock - currentBlockNumber
  if (distance >= 12) return false;

  return true
}

async function processBlock(blockNumber: number): Promise<void> {
  const processor = new BlockProcessor(blockNumber)
  return processor.call()
}

async function getNextBlockNumber(): Promise<number> {
  let result = await getlastBlockNumber()
  if (result === null) {
    result = await nextBlockNum()
    if (result === null) throw new Error('last-block-num from Redis is null');
    await setLastBlockNumber(result)
    console.log('BlockNum did not exists from redis, starting from newest block')
  }

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
