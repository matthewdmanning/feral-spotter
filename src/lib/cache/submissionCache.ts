/**
 * utils/submissionCache.ts
 *
 * One MMKV entry per submission, keyed by ID.
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

import { mmkvInstance } from "@/src/lib/cache/storage";
import type { LocationType, TimeType } from "@/src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheStatus = "In Progress" | "Submitted" | "Sending" | "Failed";

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
  location_type: LocationType;
  time_type: TimeType;
  address?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string; // ISO string
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

function readIndex(): string[] {
  try {
    const raw = mmkvInstance.getString(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  mmkvInstance.set(INDEX_KEY, JSON.stringify(ids));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new cache entry. Status is always 'In Progress' on creation.
 * Also sets the "current" pointer to this ID.
 */
export function createSubmissionCache(
  id: string,
  metadata: CacheMetadata,
): SubmissionCacheFile {
  const now = new Date().toISOString();
  const entry: SubmissionCacheFile = {
    id,
    created_at: now,
    updated_at: now,
    status: "In Progress",
    metadata,
    cats: [],
  };
  mmkvInstance.set(CACHE_PREFIX + id, JSON.stringify(entry));
  const idx = readIndex();
  if (!idx.includes(id)) writeIndex([...idx, id]);
  mmkvInstance.set(CURRENT_KEY, id);
  return entry;
}

export function getSubmissionCache(id: string): SubmissionCacheFile | null {
  try {
    const raw = mmkvInstance.getString(CACHE_PREFIX + id);
    return raw ? (JSON.parse(raw) as SubmissionCacheFile) : null;
  } catch {
    return null;
  }
}

/**
 * Partial update — merges into existing entry and refreshes updated_at.
 * Silently no-ops if the entry doesn't exist.
 */
export function updateSubmissionCache(
  id: string,
  updates: Partial<Omit<SubmissionCacheFile, "id" | "created_at">>,
): void {
  const existing = getSubmissionCache(id);
  if (!existing) return;
  const updated: SubmissionCacheFile = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  mmkvInstance.set(CACHE_PREFIX + id, JSON.stringify(updated));
}

/**
 * Hard delete. Removes from index and clears current pointer if it matched.
 * Only called from Reset confirm.
 */
export function deleteSubmissionCache(id: string): void {
  mmkvInstance.delete(CACHE_PREFIX + id);
  writeIndex(readIndex().filter((i) => i !== id));
  if (mmkvInstance.getString(CURRENT_KEY) === id) {
    mmkvInstance.delete(CURRENT_KEY);
  }
}

// ─── Listing ──────────────────────────────────────────────────────────────────

/**
 * Returns all cache entries ordered newest-first by created_at.
 */
export function getAllSubmissionCaches(): SubmissionCacheFile[] {
  return readIndex()
    .map(getSubmissionCache)
    .filter((c): c is SubmissionCacheFile => c !== null)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

// ─── Current-pointer helpers ──────────────────────────────────────────────────

export function getCurrentCacheId(): string | null {
  return mmkvInstance.getString(CURRENT_KEY) ?? null;
}

export function clearCurrentCacheId(): void {
  mmkvInstance.delete(CURRENT_KEY);
}
