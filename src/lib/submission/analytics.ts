/**
 * lib/submission/analytics.ts
 * Sighting-scoped analytics: fires an event with the cached Submission's
 * metadata as properties. Lives beside the cache shape it reads so that
 * shared/analytics stays free of feature types.
 */

import type { AnalyticsEvent } from '@/src/shared/analytics/analytics'
import { captureEvent } from '@/src/shared/analytics/analytics'
import {
  sightingPhotoCount,
  type SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'

/**
 * Fire a PostHog event, but only when IS_PRERELEASE is true and the user has
 * accepted the data-collection disclosure. Includes submission metadata as
 * event properties.
 */
export function fireAnalyticsEvent(
  event: AnalyticsEvent,
  cache: SubmissionCacheFile,
  extra?: Record<string, unknown>,
): void {
  captureEvent(event, {
    cache_id: cache.id,
    cache_status: cache.status,
    created_at: cache.created_at,
    location_method: cache.metadata.location_method,
    time_method: cache.metadata.time_method,
    cat_count: cache.cats.length,
    photo_count: sightingPhotoCount(cache),
    ...extra,
  })
}
