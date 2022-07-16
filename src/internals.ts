/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import dotenv from 'dotenv'
import runInternals from './lib/internalTxnProcessor'
import captureException from './lib/captureException'

if (process.env.NODE_ENV === 'development') dotenv.config({ path: './.env.local' });

// Loops forever. Process is managed on servers by PM2
(async() => {
  try {
    while (true) {
      try {
        await runInternals()
      } catch(e) {
        console.log(e)
        captureException(e)
      }
    }
  } catch(e) {
    console.log(e)
    captureException(e)
  }
})();

