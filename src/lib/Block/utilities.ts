import getSignature from './erc20Signature'

async function getFunctionName(input: string|null|undefined): Promise<string|null> {
  if (!input || input === '0x') return null;

  const contractAddress = input.slice(0,10)
  return getSignature(contractAddress)
}

function mergeAddresses(existingAddresses: string[], addtlAddresses: string[]): string[] {
  const newAddresses = [...existingAddresses, ...addtlAddresses]
  return Array.from(new Set(newAddresses)) // De-dupe and return
}

function parseValue(value: number, decimals = 18): string {
  return (value/10**decimals).toString()
}

export {
  getFunctionName,
  mergeAddresses,
  parseValue
}
