import axios, { AxiosResponse } from 'axios';
import { DefaultParams } from '../../interfaces/harmony/Client';
import captureException from '../captureException'

const harmonyUrl = 'https://rpc.s0.t.hmny.io'

async function getBlockByNum(blockNum: number): Promise<AxiosResponse|null> {
  try {
    const method = 'hmyv2_getBlockByNumber'
    const methodParams = [blockNum, { "fullTx": true, "inclTx": true, "InclStaking": false }]

    const response = await axios.post(harmonyUrl, defaultParams(method, methodParams))
    return response
  } catch(e) {
    captureException(e)
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

export { getBlockByNum, getLogs }
