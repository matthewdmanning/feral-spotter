/**
 * lib/firstLaunch.ts
 * Tracks whether the app has been opened before.
 * Uses mmkvInstance (synchronous, no async delay).
 */
import { mmkvInstance } from "@/src/lib/cache/storage";

const KEY = "has_launched";

export function isFirstLaunch(): boolean {
  return !mmkvInstance.getBoolean(KEY);
}

export function markLaunched(): void {
  mmkvInstance.set(KEY, true);
}
