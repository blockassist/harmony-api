import BlockProcessor from './BlockProcessor'
import { getlastBlockNumber, updateLastBlockNumber } from '../firestore'


export default async function (): Promise<void> {
  const currentBlockNumber = await getNextBlockNumber()
  await processBlock(currentBlockNumber)
  await updateLastBlockNumber(currentBlockNumber)
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
