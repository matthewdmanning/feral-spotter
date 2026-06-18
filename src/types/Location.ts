/**
 * types/Location.ts
 * Canonical location payload transmitted to the backend.
 */

import type { LocationObjectCoords } from "expo-location";

export interface LocationType {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export function toLocationType(coords: LocationObjectCoords): LocationType {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
  };
}
