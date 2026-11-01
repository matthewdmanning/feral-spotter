/**
 * hooks/useBackHandler.ts
 * Registers an Android hardware-back-press handler for the lifetime of the
 * calling component. Return true from the handler to swallow the event
 * (e.g. to run custom navigation) or false to let the default back behavior run.
 *
 * Subscribes once per mount and calls the latest handler through a ref.
 * Re-subscribing on every new handler identity would move this handler to
 * the front of Android's last-registered-first order on each render.
 */

import { useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'

export function useBackHandler(handler: () => boolean): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  }, [handler])
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      latest.current(),
    )
    return () => sub.remove()
  }, [])
}
