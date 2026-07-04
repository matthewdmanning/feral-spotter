/**
 * types/Cat.ts
 * Enum-like field types for the cat observation form.
 */

export type CatAge = "kitten" | "juvenile" | "adult" | "senior";
export type EarTipped = "yes" | "no" | "unsure";
export type Owned = "yes" | "no" | "unsure";
export type CatPattern =
  | "solid"
  | "tabby"
  | "calico"
  | "bicolor"
  | "tortoiseshell"
  | "unknown";
export type HairLength = "short" | "medium" | "long";
export type CatColor =
  | "black"
  | "white"
  | "orange"
  | "gray"
  | "brown"
  | "cream"
  | "mixed";
export type CatSex = "male" | "female" | "unknown";
export type HealthLevel = 1 | 2 | 3;
