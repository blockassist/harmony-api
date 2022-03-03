import axios, { AxiosResponse } from 'axios'
import captureException from './captureException'
import Redis from './Redis'
import SignatureReponse from '../interfaces/SignatureResponse'

let redis;
const sigExpTime = 864000
const NullSigVal = 'NULL SIG'

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

  await redisClient().setExAsync(key, sigData, sigExpTime)
}

async function requestSig(hex: string): Promise<string | null> {
  const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${hex}`
  try {
    const response:AxiosResponse = await axios.get(url)
    const signature:SignatureReponse = response.data
    if (signature.count > 0) return signature.results[0].text_signature;
    return null
  } catch(e) {
    captureException(e)
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
