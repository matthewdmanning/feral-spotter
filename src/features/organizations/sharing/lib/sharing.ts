import {
  offeredFields,
  SHARING_FIELD_LABELS,
  type SharingSettings,
} from '@/src/shared/types/Organizations'
export { buildGrant } from '../../lib/permissions'
export const FIELD_LABELS = SHARING_FIELD_LABELS

export const FALLBACK_ORGANIZATION_NAME = 'Selected organization'

/** "cat count, approximate area[, …offered fields]" as shown before confirming. */
export function includedSummary(
  settings: SharingSettings,
  anonymous: boolean,
): string {
  return [
    'cat count',
    'approximate area',
    ...offeredFields(settings, anonymous).map((key) => FIELD_LABELS[key]),
  ].join(', ')
}
