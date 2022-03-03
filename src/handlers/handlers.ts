import { Request, Response } from 'express'
import captureException from '../lib/captureException'
import Block from '../lib/harmony/Block'

export const rootHandler = async (req: Request, res: Response) => {
  try {
    const blockNumber = Number(req.query.blockNumber)
    const block = new Block(blockNumber)
    const txns = await block.getTransactions()

    return res.json(txns)
  } catch(e) {
    captureException(e)
    return res.status(500).send('Something broke!')
  }
};

export const testHandler = async (_req: Request, res: Response) => res.json('ok')
