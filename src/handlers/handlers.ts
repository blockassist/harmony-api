import { Request, Response } from 'express'

// This service doesn't take any incoming API requests
// but I'm leaving this file here to use for development

export const rootHandler = async (_req: Request, res: Response) => {
  try {
    return res.json('OK')
  } catch(e) {
    console.log(e)
    return res.status(500).send('Something broke!')
  }
};
