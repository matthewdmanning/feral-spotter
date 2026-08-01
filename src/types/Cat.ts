/**
 * types/Cat.ts
 * Enum-like field types for the cat observation form.
 */

export type CatAge = "kitten" | "juvenile" | "adult" | "senior" | "unknown";
export type EarTipped = "yes" | "no" | "unsure";
export type Owned = "yes" | "no" | "unsure";
export type CatPattern =
  | "solid"
  | "tabby"
  | "calico"
  | "bicolor"
  | "tortoiseshell"
  | "unknown";
export type HairLength = "short" | "medium" | "long" | "unknown";
export type CatColor =
  | "black"
  | "white"
  | "orange"
  | "gray"
  | "brown"
  | "cream"
  | "mixed"
  | "unknown";
export type CatSex = "male" | "female" | "unknown";
export type HealthLabel = "poor" | "fair" | "good" | "unknown";
