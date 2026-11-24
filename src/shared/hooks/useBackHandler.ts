/**
 * shared/hooks/useBackHandler.ts
 * Registers an Android hardware-back-press handler for the lifetime of the
 * calling component. Return true from the handler to swallow the event
 * (e.g. to run custom navigation) or false to let the default back behavior run.
 *
 * Subscribes once per mount and calls the latest handler through a ref.
 * Re-subscribing on every new handler identity would move this handler to
 * the front of Android's last-registered-first order on each render.
 *
 * Answers only while its screen is focused (NAV-1): a screen left mounted
 * under a pushed one must not swallow that screen's Back.
 */

import { useIsFocused } from 'expo-router'
import { useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'

export function useBackHandler(handler: () => boolean): void {
  const isFocused = useIsFocused()
  const latest = useRef(handler)
  const focused = useRef(isFocused)
  useEffect(() => {
    latest.current = handler
    focused.current = isFocused
  }, [handler, isFocused])
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      focused.current ? latest.current() : false,
    )
    return () => sub.remove()
  }, [])
}
