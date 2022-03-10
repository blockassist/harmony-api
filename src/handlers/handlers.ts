import { Request, Response } from 'express'

export const rootHandler = async (_req: Request, res: Response) => {
  try {
    return res.json('OK')
  } catch(e) {
    console.log(e)
    return res.status(500).send('Something broke!')
  }
};
