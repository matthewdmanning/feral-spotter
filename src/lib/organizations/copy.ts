import type { SharingFields } from '@/src/types/Organizations'
import organizationsCopy from '@/src/content/organizationsCopy.json'

/** All organization UI copy is configured in organizationsCopy.json. */
export { organizationsCopy }

/** Substitutes named values without interpreting user or catalog content as a template. */
export function formatOrganizationCopy(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (placeholder, key: string) => values[key] ?? placeholder,
  )
}

/** Labels used in both the initial disclosure and renewed confirmation. */
export const FIELD_LABELS: Record<keyof SharingFields, string> =
  organizationsCopy.fields
