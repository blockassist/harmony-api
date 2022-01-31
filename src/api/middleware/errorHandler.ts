import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../../entities/CustomError';

/**
 * Custom error handler to standardize error objects returned to
 * the client
 *
 * @param err Error caught by Express.js
 * @param req Request object provided by Express
 * @param res Response object provided by Express
 */
function handleError(
  err: TypeError | CustomError,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  let customError = err;
  if (next) console.log(next)

  if (!(err instanceof CustomError)) {
    customError = new CustomError(
      'Oops. The server encountered an error.'
    );
  }

  res.status((customError as CustomError).status).send(customError);
};

export default handleError;
