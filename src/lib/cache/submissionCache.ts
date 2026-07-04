/**
 * utils/submissionCache.ts
 *
 * One AsyncStorage entry per submission, keyed by ID.
 * A separate index key tracks all known IDs for listing.
 * A "current" key tracks the active in-progress submission.
 *
 * Status lifecycle:
 *   'In Progress' → created when submission begins
 *   'Sending'     → set immediately on Submit press
 *   'Submitted'   → set on API success confirmation
 *   'Failed'      → set on API error
 *
 * Deletion: only on explicit Reset confirm (never on app restart or nav).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocationType, TimeType } from "@/src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheStatus = "In Progress" | "Submitted" | "Sending" | "Failed";

/** How the location/time fields were captured, as chosen on the Create screen. */
export type LocationMethod = "device" | "pin" | "address";
export type TimeMethod = "device" | "manual" | "metadata";

export interface CachedCat {
  local_id: string;
  age: string;
  ear_tipped: string;
  health: number;
  owned_domesticated: string;
  pattern: string;
  hair_length: string;
  color: string;
  sex: string;
  photo_local_ids: string[];
  photos_reviewed: boolean;
}

export interface CacheMetadata {
  location_method: LocationMethod;
  time_method: TimeMethod;
  location_type?: LocationType;
  time_type?: TimeType;
  address?: string;
}

export interface SubmissionCacheFile {
  id: string;
  created_at: string; // ISO — used for ordering in Feral Reports
  updated_at: string; // ISO
  status: CacheStatus;
  metadata: CacheMetadata;
  cats: CachedCat[];
  photo_links?: string[]; // file:// URIs (if keepPhotosOnDevice) or cloud URLs,
  // populated on Submit press only
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const INDEX_KEY = "submission_cache_index"; // JSON array of IDs
const CACHE_PREFIX = "submission_cache_"; // + id
const CURRENT_KEY = "submission_cache_current"; // active in-progress ID

// ─── Index helpers ────────────────────────────────────────────────────────────

async function readIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new cache entry. Status is always 'In Progress' on creation.
 * Also sets the "current" pointer to this ID.
 */
export async function createSubmissionCache(
  id: string,
  metadata: CacheMetadata,
): Promise<SubmissionCacheFile> {
  const now = new Date().toISOString();
  const entry: SubmissionCacheFile = {
    id,
    created_at: now,
    updated_at: now,
    status: "In Progress",
    metadata,
    cats: [],
  };
  await AsyncStorage.setItem(CACHE_PREFIX + id, JSON.stringify(entry));
  const idx = await readIndex();
  if (!idx.includes(id)) await writeIndex([...idx, id]);
  await AsyncStorage.setItem(CURRENT_KEY, id);
  return entry;
}

export async function getSubmissionCache(
  id: string,
): Promise<SubmissionCacheFile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + id);
    return raw ? (JSON.parse(raw) as SubmissionCacheFile) : null;
  } catch {
    return null;
  }
}

/**
 * Partial update — merges into existing entry and refreshes updated_at.
 * Silently no-ops if the entry doesn't exist.
 */
export async function updateSubmissionCache(
  id: string,
  updates: Partial<Omit<SubmissionCacheFile, "id" | "created_at">>,
): Promise<void> {
  const existing = await getSubmissionCache(id);
  if (!existing) return;
  const updated: SubmissionCacheFile = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(CACHE_PREFIX + id, JSON.stringify(updated));
}

/**
 * Hard delete. Removes from index and clears current pointer if it matched.
 * Only called from Reset confirm.
 */
export async function deleteSubmissionCache(id: string): Promise<void> {
  await AsyncStorage.removeItem(CACHE_PREFIX + id);
  await writeIndex((await readIndex()).filter((i) => i !== id));
  if ((await AsyncStorage.getItem(CURRENT_KEY)) === id) {
    await AsyncStorage.removeItem(CURRENT_KEY);
  }
}

// ─── Listing ──────────────────────────────────────────────────────────────────

/**
 * Returns all cache entries ordered newest-first by created_at.
 */
export async function getAllSubmissionCaches(): Promise<
  SubmissionCacheFile[]
> {
  const ids = await readIndex();
  const entries = await Promise.all(ids.map(getSubmissionCache));
  return entries
    .filter((c): c is SubmissionCacheFile => c !== null)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

// ─── Current-pointer helpers ──────────────────────────────────────────────────

export async function getCurrentCacheId(): Promise<string | null> {
  return (await AsyncStorage.getItem(CURRENT_KEY)) ?? null;
}

export async function clearCurrentCacheId(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_KEY);
}
