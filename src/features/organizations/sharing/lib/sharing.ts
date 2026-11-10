import {
  offeredFields,
  SHARING_FIELD_LABELS,
  type SharingSettings,
} from '@/src/shared/types/Organizations'

export const FALLBACK_ORGANIZATION_NAME = 'Selected organization'

/** "cat count, approximate area[, …offered fields]" as shown before confirming. */
export function includedSummary(
  settings: SharingSettings,
  anonymous: boolean,
): string {
  return [
    'cat count',
    'approximate area',
    ...offeredFields(settings, anonymous).map(
      (key) => SHARING_FIELD_LABELS[key],
    ),
  ].join(', ')
}
