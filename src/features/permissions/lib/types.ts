/**
 * lib/permissions/types.ts
 * Shared port for the four OS-permission adapters (#358). Each adapter wraps
 * a different library's own API shape internally -- the raw status/response
 * types stay adapter-internal, only check()/request() are common, since the
 * resource-specific nuance (accuracy, partial access) is what was drifting
 * and needs to stay visible rather than get averaged into one enum.
 */
export interface PermissionGate {
  /** Is this permission usable right now, without prompting. */
  check(): Promise<boolean>
  /** Prompt if needed; resolves with whether it's usable afterward. */
  request(): Promise<boolean>
}
