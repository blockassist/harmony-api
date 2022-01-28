export class NullTransactionsError extends Error {
  constructor(message: string) {
    super(message);
    // this line needed to use "instanceof" properly
    Object.setPrototypeOf(this, NullTransactionsError.prototype);
  }
}
