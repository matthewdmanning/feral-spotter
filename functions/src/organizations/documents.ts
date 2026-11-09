import { getFirestore } from 'firebase-admin/firestore'
import { clean } from './store'

/** Server-only Firestore documents; missing data is distinct from an unavailable service. */
export async function readDocument<T>(
  path: string,
  empty: () => T,
): Promise<{ value: T }> {
  const snapshot = await getFirestore().doc(path).get()
  return { value: snapshot.exists ? (snapshot.data() as T) : empty() }
}
export async function changeDocument<T>(
  path: string,
  empty: () => T,
  change: (value: T) => T,
): Promise<T> {
  return getFirestore().runTransaction(async (transaction) => {
    const ref = getFirestore().doc(path)
    const snapshot = await transaction.get(ref)
    const next = change(snapshot.exists ? (snapshot.data() as T) : empty())
    transaction.set(ref, clean(next) as FirebaseFirestore.DocumentData)
    return next
  })
}
