import axios, { AxiosResponse } from 'axios'
import Redis from '../Redis'
import SignatureReponse from '../../interfaces/SignatureResponse'

let redis;
const NullSigVal = 'NULL SIG'
const NullSigExp = 1800 // 30-min

export default async function getSignature(hex: string): Promise<string | null> {
  // Check for cached version of signature
  const key = redisKey(hex)
  const result = await redisClient().getAsync(key)
  if (result === NullSigVal) return null;
  if (result !== null) return result;

  // Request signature, cache and return result
  const signature = await requestSig(hex)
  await cacheSig(hex, signature);

  return signature
}

async function cacheSig(hex: string, signature: string|null): Promise<void> {
  const key = redisKey(hex)
  const sigData = (signature || NullSigVal)

  if (sigData === NullSigVal) {
    await redisClient().setExAsync(key, sigData, NullSigExp)
  } else {
    await redisClient().setExAsync(key, sigData, sigExpTime())
  }
}

function sigExpTime(): number {
  const min = 777600 // 9-days
  const max = 864000 // 10-days
  return Math.floor(Math.random() * (max - min + 1) + min)
}

async function requestSig(hex: string): Promise<string | null> {
  const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${hex}`
  try {
    const response:AxiosResponse = await axios.get(url)
    const signature:SignatureReponse = response.data
    if (signature.count > 0) return signature.results[0].text_signature;
    return null
  } catch {
    return null
  }
}


function redisClient(): Redis {
  if (redis) return redis;
  redis = new Redis()
  return redis
}

function redisKey(hex: string): string {
  return `signature-${hex}`
}
