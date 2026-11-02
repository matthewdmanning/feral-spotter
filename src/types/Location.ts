/**
 * types/Location.ts
 * Canonical location payload transmitted to the backend.
 */

export interface LocationType {
  latitude: number
  longitude: number
  accuracy: number | null
}
