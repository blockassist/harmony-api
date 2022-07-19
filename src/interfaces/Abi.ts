export default interface Abi {
  abi: Array<Record<string, unknown>>
  contractName?: string|null
  compiler?: string|null
  sourceCode?: string|null
  constructorArguments?: string|null
  contractAddress?: string
  libraries?: unknown[]
  cached?: Record<string, unknown>
  proxyDetails?: string|null|Record<string, unknown>
}
