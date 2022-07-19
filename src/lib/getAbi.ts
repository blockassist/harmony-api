import Abi from '../interfaces/Abi'
import { requestAbi } from './harmony/client'
import Redis from './Redis'

let redis;

// Function that returns ABI code
// Checks for ABI in redis/cache and returns if it exists
// Checks if ABI for contract address was previously marked absent and early returns if true (prevents API call)
// If contract isn't cached and isn't absent it will make an API request for the ABI and cache the result
export default async function getAbi(contract: string): Promise<Abi|null> {
  try {
    const cachedAbi = await getCachedAbi(contract)
    if (cachedAbi !== null) return cachedAbi;

    const isAbsent = await absentAbi(contract)
    if (isAbsent) return null;

    const abi = await requestAbi(contract)
    if (abi !== null) {
      await cacheAbi(abi, contract)
      return abi
    }

    await setAbsentAbi(contract)
    return null
  } catch {
    return null
  }
}

async function getCachedAbi(contract: string): Promise<Abi|null> {
  const abi = await redisClient().getAsync(`abi-${contract}`)
  if (!abi) return null;

  return JSON.parse(abi)
}

async function cacheAbi(abi: Abi, contract: string): Promise<void> {
  const json = JSON.stringify(abi)
  await redisClient().setExAsync(`abi-${contract}`, json, expTime())
}

async function absentAbi(contract: string): Promise<boolean> {
  const absent = await redisClient().getAsync(`absent-abi-${contract}`)
  if (absent) return true;

  return false
}

async function setAbsentAbi(contract: string): Promise<void> {
  await redisClient().setExAsync(`absent-abi-${contract}`, '0', expTime(true))
}

function redisClient(): Redis {
  if (redis) return redis;
  redis = new Redis()
  return redis
}

function expTime(absent=false): number {
  // Variable redis expiration times to prevent everything from expiring at the same time
  const min = (absent ? 80000 : 170000)
  const max = (absent ? 86400 : 172800)

  return Math.floor(Math.random() * (max - min + 1) + min)
}
