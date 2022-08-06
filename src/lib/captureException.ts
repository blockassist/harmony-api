/* eslint-disable no-console */
// import * as Sentry from '@sentry/node';

// let sentry;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (exception: any): void {
  console.log('Exception Thrown:')
  console.log(exception.message)
  console.log(exception)

  // if (process.env.ENV_NAME !== 'production') return;

  // sentry = (sentry || Sentry.init({ dsn: process.env.SENTRY_DSN }))
  // Sentry.captureException(exception)
}
