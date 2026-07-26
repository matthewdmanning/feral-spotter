/**
 * hooks/useFeralReports.ts
 * Loads cache files and handles refresh.
 */

import {
  EVENTS,
  fireAnalyticsEvent,
  IS_PRERELEASE,
} from "@/src/lib/analytics/analytics";
import {
  getAllSubmissionCaches,
  type SubmissionCacheFile,
} from "@/src/lib/cache/submissionCache";
import { useCallback, useEffect, useState } from "react";

export interface FeralReportsResult {
  caches: SubmissionCacheFile[];
  refreshing: boolean;
  load: () => void;
  onRefresh: () => void;
}

export function useFeralReports(): FeralReportsResult {
  const [caches, setCaches] = useState<SubmissionCacheFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const all = await getAllSubmissionCaches();
    setCaches(all);
    if (IS_PRERELEASE && all.length > 0) {
      all.forEach((cache) => fireAnalyticsEvent(EVENTS.REPORTS_VIEWED, cache));
    }
  }, []);

  useEffect(() => {
    getAllSubmissionCaches().then((all) => {
      setCaches(all);
      if (IS_PRERELEASE && all.length > 0) {
        all.forEach((cache) => fireAnalyticsEvent(EVENTS.REPORTS_VIEWED, cache));
      }
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { caches, refreshing, load, onRefresh };
}
