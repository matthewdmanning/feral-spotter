/**
 * utils/cache.ts
 * Persistent submission cache with TTL.
 * Clear cache never removes checked (submission) photos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SubmittedSubmission } from '@/src/types'

const CACHE_KEY = '@feralspotter_cache'
const DEFAULT_TTL_DAYS = 30

export interface CacheEntry {
  id: string
  data: SubmittedSubmission
  created_at: string
  expires_at: string
}

// ─── Read ────────────────────────────────────────────────────────────────────

async function readRaw(): Promise<CacheEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function writeRaw(entries: CacheEntry[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entries))
}

// ─── Prune expired ───────────────────────────────────────────────────────────

export async function pruneExpiredCache(): Promise<void> {
  const entries = await readRaw()
  const now = Date.now()
  const valid = entries.filter((e) => new Date(e.expires_at).getTime() > now)
  if (valid.length !== entries.length) await writeRaw(valid)
}

// ─── Append ──────────────────────────────────────────────────────────────────

export async function appendToCache(
  submission: SubmittedSubmission,
  ttlDays: number = DEFAULT_TTL_DAYS
): Promise<void> {
  const entries = await readRaw()
  const now = new Date()
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)

  const entry: CacheEntry = {
    id: submission.id,
    data: submission,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  }

  await writeRaw([...entries, entry])
}

// ─── Read (pruned) ───────────────────────────────────────────────────────────

export async function readCache(): Promise<CacheEntry[]> {
  await pruneExpiredCache()
  return readRaw()
}

// ─── Clear ───────────────────────────────────────────────────────────────────

/**
 * Clears all cache entries.
 * Does NOT touch photo files — photo cleanup is handled separately.
 */
export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY)
}
