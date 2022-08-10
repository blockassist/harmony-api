# BlockManager
Runs in a loop. Will wait if we are >= the set BLOCK_DISTANCE from newest available block on the chain

- Get next block number (based on last one we successfully processed)
  - Waits if we are too far ahead
- Calls BlockProcessor with Block-number
- If successful it updates Firestore with Block Number

# BlockProcessor
Is passed a block number, calls the BlockTransactionAssembler with the block number and gets all transactions. Finds relevant transactions for any addresses we follow and uploads them to Firestore

# BlockTransactionAssembler
Assembles a complete transaction from Externals, Logs and Internals.
- Gather transactions
  - External
  - Logs
  - Internals
- Assemble
  - Externals
    - Parses from HTTP response
    - Creates Main Transactions object
  - Logs
    - Parses from HTTP response
    - Appends to existing Transactions object
  - Internals
    - Parses from redis
    - Appends to existing Transactions object
