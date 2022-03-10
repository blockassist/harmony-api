import admin from 'firebase-admin'
import { Firestore } from 'firebase-admin/firestore'
import { HarmonyTransaction } from '../interfaces/harmony/Block'
import captureException from './captureException'

let firestoreClient:Firestore | null = null;

function client(): Firestore {
  if (firestoreClient !== null) return firestoreClient;

  const serviceAccount = JSON.parse(process.env.FIRESTORE_CREDENTIALS)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  firestoreClient = admin.firestore();
  return firestoreClient
}

async function getSubscribedAddresses(): Promise<string[]> {
  const collectionName = `addresses-${process.env.ENV_NAME}`
  const documents = await client()
        .collection(collectionName)
        .listDocuments()

  return documents.map((d) => d.id)
}

async function getlastBlockNumber(): Promise<number|null> {
  try {
    const collectionName = `block-tracking-${process.env.ENV_NAME}`
    const document = client().collection(collectionName).doc('lastBlockProcessed')
    const blockDoc = await document.get()
    const { lastBlockNumber } = blockDoc.data()

    return lastBlockNumber
  } catch(e) {
    captureException(e)
    return null
  }
}

async function updateLastBlockNumber(lastBlockNumber: number): Promise<boolean> {
  try {
    const processedAt = Date.now()
    const collectionName = `block-tracking-${process.env.ENV_NAME}`
    const document = client().collection(collectionName).doc('lastBlockProcessed')
    await document.set({ lastBlockNumber, processedAt })

    return true
  } catch(e) {
    captureException(e)
    return false
  }
}

async function batchCreateTransactions(transactions: HarmonyTransaction[]): Promise<boolean> {
  try {
    const batch = client().batch();
    const collectionName = `transactions-${process.env.ENV_NAME}`
    transactions.forEach((txn) => {
      const document = client().collection(collectionName).doc(txn.hash)
      batch.set(document, txn)
    })

    await batch.commit()

    return true
  } catch(e) {
    captureException(e)
    return false
  }
}

export { getSubscribedAddresses, getlastBlockNumber, updateLastBlockNumber, batchCreateTransactions }
