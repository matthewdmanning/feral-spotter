import { getFirestore } from 'firebase-admin/firestore'

/** Server-only Firestore documents; missing data is distinct from an unavailable service. */
export async function readDocument<T>(
  path: string,
  empty: () => T,
): Promise<{ value: T }> {
  const snapshot = await getFirestore().doc(path).get()
  return { value: snapshot.exists ? (snapshot.data() as T) : empty() }
}
