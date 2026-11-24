/**
 * shared/hooks/useMapFrame.ts
 * The frame plumbing every native map shares: measure the frame, turn the
 * view for that size into a stable camera, and report finger-down to a parent
 * that pauses its scroll while the map is touched.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import type { MapSize, MapView } from '@/src/shared/lib/mapView'

export function useMapFrame(
  viewForSize: (size: MapSize) => MapView | null,
  onTouchActiveChange?: (active: boolean) => void,
) {
  const [size, setSize] = useState<MapSize | null>(null)
  const view = size ? viewForSize(size) : null
  // Keyed on values, not identity: a re-read builds equal points as new
  // objects, and a new camera object would snap back a user's pan.
  const latitude = view?.coordinates.latitude
  const longitude = view?.coordinates.longitude
  const zoom = view?.zoom
  const cameraPosition = useMemo(
    () =>
      latitude == null || longitude == null
        ? undefined
        : { coordinates: { latitude, longitude }, zoom },
    [latitude, longitude, zoom],
  )

  // A gesture cut off by unmount never sends its touch end; the parent's
  // scroll lock must not stay on.
  const touchActiveChange = useRef(onTouchActiveChange)
  useEffect(() => {
    touchActiveChange.current = onTouchActiveChange
  }, [onTouchActiveChange])
  useEffect(() => () => touchActiveChange.current?.(false), [])

  const frameProps = {
    onLayout: ({ nativeEvent }: LayoutChangeEvent) => {
      const { width, height } = nativeEvent.layout
      if (width !== size?.width || height !== size?.height)
        setSize({ width, height })
    },
    onTouchStart: () => onTouchActiveChange?.(true),
    onTouchEnd: () => onTouchActiveChange?.(false),
    onTouchCancel: () => onTouchActiveChange?.(false),
  }

  return { cameraPosition, frameProps }
}
