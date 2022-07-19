import Web3 from 'web3'
import Contract from '../../interfaces/harmony/Contract'
import Redis from '../Redis';
import captureException from '../captureException'
import erc20Abi from '../erc20Abi'
import getAbi from '../getAbi'

let w3Client;
let redis;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function web3Client(): any {
  if (w3Client != null) return w3Client;
  
  const wssUrl = 'https://a.api.s0.t.hmny.io'
  const provider = new Web3.providers.HttpProvider(wssUrl)
  w3Client = new Web3(provider)
  return w3Client
}

function topicToAddress(val: string): string | null {
  // Converts 0 padded topic address to regular address
  try {
    const web3 = web3Client()
    return web3.eth.abi.decodeParameter('address', val)
  } catch(e) {
    captureException(e)
    return null
  }
}

async function getContract(address: string): Promise<Contract|null> {
  try {
    // If contract exists in cache return it
    const cachedContract = await getContractFromCache(address);
    if (cachedContract !== null) return cachedContract;

    // If we already know contract data isn't parseable, return null
    if (await isBadContract(address)) return null;

    // Lookup contract & return if exists
    const web3 = web3Client()
    const contract = new web3.eth.Contract(erc20Abi, address)
    const contractInfo = await parseContract(contract, address)
    await cacheContract(contractInfo)
    return contractInfo
  } catch {
    try {
      const abi = await getAbi(address)
      if (abi === null) return null;

      const web3 = web3Client()
      const contract = new web3.eth.Contract(abi, address)
      const contractInfo = await parseContract(contract, address)

      await cacheContract(contractInfo)
      return contractInfo
    } catch {
      // Catch error for bad contract, cache and return null
      await cacheBadContract(address)
      return null
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseContract(contract: any, address: string): Promise<Contract> {
  const symbol = await contract.methods.symbol().call()
  const decimals = await contract.methods.decimals().call()
  const name = await contract.methods.name().call()
  return { address, symbol, decimals, name }
}

function redisClient(): Redis {
  if (redis) return redis;
  redis = new Redis()
  return redis
}

async function cacheContract(contract: Contract): Promise<void> {
  const contractKey = `contract-${contract.address}`
  await redisClient().setExObjectAsync(contractKey, contract, expTime())
}

async function isBadContract(address: string): Promise<boolean> {
  const contractKey = `badcontract-${address}`
  const result = await redisClient().getAsync(contractKey)
  return result === '0'
}

async function cacheBadContract(address: string): Promise<void> {
  const contractKey = `badcontract-${address}`
  await redisClient().setExAsync(contractKey, '0', expTime(true))
}

async function getContractFromCache(address: string): Promise<Contract|null> {
  const contractKey = `contract-${address}`
  return redisClient().getObjectAsync(contractKey)
}

function expTime(bad=false): number {
  const min = (bad ? 80000 : 170000)
  const max = (bad ? 86400 : 172800)

  return Math.floor(Math.random() * (max - min + 1) + min)
}


export { getContract, topicToAddress }
