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
