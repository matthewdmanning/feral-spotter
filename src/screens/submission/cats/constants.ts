/**
 * screens/submission/cats/constants.ts
 * Options arrays, default values, and pure utilities for the cat observation form.
 * No React imports — safe to import from hooks and non-component contexts.
 */

import type {
  CatAge,
  CatColor,
  CatPattern,
  CatSex,
  EarTipped,
  HairLength,
  HealthLevel,
  Owned,
} from "@/src/types";

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CAT_DEFAULTS = {
  age: "adult" as CatAge,
  earTipped: "unsure" as EarTipped,
  owned: "unsure" as Owned,
  pattern: "unknown" as CatPattern,
  hairLength: "short" as HairLength,
  color: "mixed" as CatColor,
  sex: "unknown" as CatSex,
  health: 2 as HealthLevel,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function healthLabel(value: HealthLevel): string {
  return value === 1 ? "Poor" : value === 3 ? "Good" : "Fair";
}

// ─── Options ──────────────────────────────────────────────────────────────────

export const AGE_OPTIONS: { value: CatAge; label: string }[] = [
  { value: "kitten", label: "Kitten" },
  { value: "juvenile", label: "Juvenile" },
  { value: "adult", label: "Adult" },
  { value: "senior", label: "Senior" },
];

export const EAR_TIPPED_OPTIONS: { value: EarTipped; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Unsure" },
];

export const OWNED_OPTIONS: { value: Owned; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Unsure" },
];

export const PATTERN_OPTIONS: { value: CatPattern; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "tabby", label: "Tabby" },
  { value: "calico", label: "Calico" },
  { value: "bicolor", label: "Bicolor" },
  { value: "tortoiseshell", label: "Tortoiseshell" },
  { value: "unknown", label: "Unknown" },
];

export const HAIR_LENGTH_OPTIONS: { value: HairLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "long", label: "Long" },
];

export const COLOR_OPTIONS: { value: CatColor; label: string }[] = [
  { value: "black", label: "Black" },
  { value: "white", label: "White" },
  { value: "orange", label: "Orange" },
  { value: "gray", label: "Gray" },
  { value: "brown", label: "Brown" },
  { value: "cream", label: "Cream" },
  { value: "mixed", label: "Mixed" },
];

export const SEX_OPTIONS: { value: CatSex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
];

export const HEALTH_OPTIONS: { value: HealthLevel; label: string }[] = [
  { value: 1 as HealthLevel, label: "Poor" },
  { value: 2 as HealthLevel, label: "Fair" },
  { value: 3 as HealthLevel, label: "Good" },
];
