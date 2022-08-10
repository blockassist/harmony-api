import parseLog  from 'eth-log-parser'
import { Log } from '../../interfaces/Block'
import EventLog from '../../interfaces/EventLog'
import erc20Abi from './erc20Abi'
import getAbi from './getAbi'

export default async function (log: Log): Promise<EventLog|null> {
  try {
    return parseLog(log, erc20Abi);
  } catch {
    try {
      const abi = await getAbi(log.address)
      if (abi === null) return null;
      const result = parseLog(log, abi.abi);
      return result;
    } catch {
      return null
    }
  }
}

