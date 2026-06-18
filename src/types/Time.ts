/**
 * types/Time.ts
 * Canonical UTC timestamp transmitted to the backend, as an ISO 8601 string
 * (the format native JS Date already produces via toISOString()).
 */

export type TimeType = string;

export function toTimeType(date: Date): TimeType {
  return date.toISOString();
}
