/**
 * types/Cat.ts
 * Enum-like field types for the cat observation form.
 */

export type CatAge = 'kitten' | 'juvenile' | 'adult' | 'senior' | 'unknown'
export type EarTipped = 'yes' | 'no' | 'unsure'
export type Owned = 'yes' | 'no' | 'unsure'
export type CatPattern =
  'tabby' | 'solid' | 'bicolor' | 'calico_tortie' | 'colorpoint' | 'unknown'
export type HairLength = 'short' | 'long' | 'unknown'
export type CatColor =
  | 'mackerel'
  | 'classic'
  | 'spotted'
  | 'orange_tabby'
  | 'torbie'
  | 'black'
  | 'blue'
  | 'white'
  | 'low_white'
  | 'medium_white'
  | 'high_white'
  | 'tortoiseshell'
  | 'calico'
  | 'dilute_tortie_calico'
  | 'seal_point'
  | 'lynx_point'
  | 'unknown'
export type CatSex = 'male' | 'female' | 'unknown'
export type HealthLabel = 'poor' | 'fair' | 'good' | 'unknown'
