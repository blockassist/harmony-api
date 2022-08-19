import captureException from './captureException'
import Redis from './Redis'

let redis;
const KEY = 'last-block-num'

async function getlastBlockNumber(): Promise<number|null> {
  try {
    const result = await redisClient().getAsync(KEY)
    if (result == null) return null;

    return parseInt(result, 10)
  } catch(e) {
    captureException(e)
    return null
  }
}

async function setLastBlockNumber(lastBlockNumber: number): Promise<boolean> {
  try {
    await redisClient().setAsync(KEY, lastBlockNumber.toString())

    return true
  } catch(e) {
    captureException(e)
    return false
  }
}

function redisClient(): Redis {
  if (redis) return redis;
  redis = new Redis()
  return redis
}

export { getlastBlockNumber, setLastBlockNumber }
