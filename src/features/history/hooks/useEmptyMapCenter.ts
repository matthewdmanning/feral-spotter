/**
 * features/history/hooks/useEmptyMapCenter.ts
 * NAV-5: where the Sightings map opens with no pins. The device's last
 * known position, else FALLBACK_MAP_CENTER. Reads nothing while `enabled`
 * is false, and never before the data disclosure is accepted.
 */

import { hasAcceptedConsent } from '@/src/shared/consent/useConsentStore'
import { FALLBACK_MAP_CENTER, type MapPoint } from '@/src/shared/lib/mapView'
import * as Location from 'expo-location'
import { useEffect, useState } from 'react'

export function useEmptyMapCenter(enabled: boolean): MapPoint {
  const [center, setCenter] = useState<MapPoint>(FALLBACK_MAP_CENTER)
  useEffect(() => {
    if (!enabled || !hasAcceptedConsent()) return
    let active = true
    Location.getLastKnownPositionAsync()
      .then((last) => {
        if (active && last)
          setCenter({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          })
      })
      .catch(() => {
        // No position: the fallback centre stays.
      })
    return () => {
      active = false
    }
  }, [enabled])
  return center
}
