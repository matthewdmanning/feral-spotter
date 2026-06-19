/**
 * hooks/useBackHandler.ts
 * Registers an Android hardware-back-press handler for the lifetime of the
 * calling component. Return true from the handler to swallow the event
 * (e.g. to run custom navigation) or false to let the default back behavior run.
 */

import { useEffect } from 'react'
import { BackHandler, Platform } from 'react-native'

export function useBackHandler(handler: () => boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', handler)
    return () => sub.remove()
  }, [handler])
}
