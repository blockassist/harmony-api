/* eslint-disable max-classes-per-file */

export class NullTransactionsError extends Error {
  constructor(message: string) {
    super(message);
    // this line needed to use "instanceof" properly
    Object.setPrototypeOf(this, NullTransactionsError.prototype);
  }
}

export class WaitForBlockError extends Error {
  constructor(message: string) {
    super(message);
    // this line needed to use "instanceof" properly
    Object.setPrototypeOf(this, WaitForBlockError.prototype);
  }
}

export class HarmonyResponseError extends Error {
  constructor(message: string) {
    super(message);
    // this line needed to use "instanceof" properly
    Object.setPrototypeOf(this, HarmonyResponseError.prototype);
  }
}

export class NoHarmonyInternals extends Error {
  constructor(message: string) {
    super(message);
    // this line needed to use "instanceof" properly
    Object.setPrototypeOf(this, NoHarmonyInternals.prototype);
  }
}
