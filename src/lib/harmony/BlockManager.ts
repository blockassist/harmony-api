import BlockProcessor from './BlockProcessor'
import { getlastBlockNumber, updateLastBlockNumber } from '../firestore'
import { WaitForBlockError } from './HarmonyErrors'
import captureException from '../captureException'

export default async function (): Promise<void> {
  try {
    const currentBlockNumber = await getNextBlockNumber()
    await processBlock(currentBlockNumber)
    await updateLastBlockNumber(currentBlockNumber)
    console.log(`Successfully processed Block: ${currentBlockNumber}`)
  } catch(e) {
    if (e instanceof WaitForBlockError) return;
    captureException(e);
  }
}

async function processBlock(blockNumber: number): Promise<void> {
  const processor = new BlockProcessor(blockNumber)
  return processor.call()
}

async function getNextBlockNumber(): Promise<number> {
  const result = await getlastBlockNumber()
  if (result === null) throw new Error('LastBlockNumber from Firebase is null');

  return (result + 1)
}
