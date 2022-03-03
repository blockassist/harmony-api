import admin from 'firebase-admin'
import { Firestore } from 'firebase-admin/firestore'

let firestoreClient:Firestore | null = null;

function client(): Firestore {
  if (firestoreClient !== null) return firestoreClient;

  const serviceAccount = JSON.parse(process.env.FIRESTORE_CREDENTIALS)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  firestoreClient = admin.firestore();
  return firestoreClient
}

async function getSubscribedAddresses(): Promise<Record<string, boolean>> {
  const results = {}
  const collectionName = `addresses-${process.env.ENV_NAME}`
  const documents = await client()
        .collection(collectionName)
        .listDocuments()

  documents.forEach((d) => { results[d.id] = true })
  return results
}

export { getSubscribedAddresses }
