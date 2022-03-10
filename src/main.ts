/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */

import dotenv from 'dotenv'
import BlockManager from './lib/harmony/BlockManager'
import captureException from './lib/captureException'

if (process.env.NODE_ENV === 'development') dotenv.config({ path: './.env.local' });

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(()=> { resolve(0) }, duration);
  })
}

(async() => {
  try {
    while (true) {
      try {
        console.log('I\'m runninggggg')
        await BlockManager()
        console.log('I done did it!')
        await sleep(10000)
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

