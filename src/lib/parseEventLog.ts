import parseLog  from 'eth-log-parser'
import { HarmonyLog } from '../interfaces/harmony/Block'
import EventLog from '../interfaces/harmony/EventLog'
import erc20Abi from './erc20Abi'
import getAbi from './getAbi'
import captureException from './captureException'

export default async function (log: HarmonyLog): Promise<EventLog|null> {
  try {
    return parseLog(log, erc20Abi);
  } catch {
    try {
      const abi = await getAbi(log.address)
      if (abi === null) return null;
      const result = parseLog(log, abi.abi);
      return result;
    } catch(e) {
      captureException(e)
      return null
    }
  }
}

