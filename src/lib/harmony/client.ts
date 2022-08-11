import axios, { AxiosResponse } from 'axios';
import { DefaultParams } from '../../interfaces/harmony/Client';
import Abi from '../../interfaces/Abi';
import { logHarmonyError } from '../firestore';
import captureException from '../captureException'

const harmonyUrl = 'https://rpc.s0.t.hmny.io'
const traceblockUrl = 'https://a.api.s0.t.hmny.io'

async function nextBlockNum(): Promise<number|null> {
  try {
    const response = await axios.post(harmonyUrl, defaultParams("hmy_blockNumber", []))
    return parseInt(response.data?.result, 16)
  } catch(e) {
    captureException(e)
    await logHarmonyError('GetNextBlockNumAxiosException')
    return null
  }
}

async function requestAbi(contract: string): Promise<Abi|null> {
  try {
    const url = `https://ctrver.t.hmny.io/fetchContractCode?contractAddress=${contract}`
    const response = await axios.get<Abi>(url)
    return response.data
  } catch(e) {
    return null
  }
}

async function getBlockByNum(blockNum: number): Promise<AxiosResponse|null> {
  try {
    const method = 'hmyv2_getBlockByNumber'
    const methodParams = [blockNum, { "fullTx": true, "inclTx": true, "InclStaking": false }]

    const response = await axios.post(harmonyUrl, defaultParams(method, methodParams))
    return response
  } catch(e) {
    captureException(e)
    await logHarmonyError('GetBlockAxiosException')
    return null
  }
}

async function getLogs(blockHex: string): Promise<AxiosResponse|null> {
  try {
    const method = 'hmy_getLogs'
    const methodParams = [{ "fromBlock": blockHex, "toBlock": blockHex }]

    const response = await axios.post(harmonyUrl, defaultParams(method, methodParams))
    return response
  } catch(e) {
    captureException(e)
    await logHarmonyError('GetLogsAxiosException')
    return null
  }
}

async function getInternals(blockHex: string): Promise<AxiosResponse|null> {
  try {
    const method = 'trace_block'
    const methodParams = [blockHex]

    const response = await axios.post(traceblockUrl, defaultParams(method, methodParams))
    return response
  } catch(e) {
    captureException(e)
    await logHarmonyError('GetInternalsAxiosException')
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultParams(method: string, params: any[]): DefaultParams {
  return {
    "jsonrpc": "2.0",
    "id": 1,
    "method": method,
    "params": params
  }
}

export { getBlockByNum, getLogs, getInternals, nextBlockNum, requestAbi }
