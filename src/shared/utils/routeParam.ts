/**
 * utils/routeParam.ts
 * expo-router types a search param as a string, but a repeated key or a
 * catch-all link delivers string[]. Normalize to the first value.
 */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
