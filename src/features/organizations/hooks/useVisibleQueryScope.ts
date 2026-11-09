import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { QueryKey } from '@tanstack/react-query'
import { queryClient } from '@/src/shared/lib/queryClient'

/** Organization data is memory-only: blur, backgrounding or unavailability drops it from the cache. */
export function useVisibleQueryScope(queryKey: QueryKey, available: boolean) {
  const [focused, setFocused] = useState(false)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      const subscription = AppState.addEventListener('change', (state) =>
        setFocused(state === 'active'),
      )
      return () => {
        subscription.remove()
        setFocused(false)
      }
    }, []),
  )
  const visible = focused && available
  const key = JSON.stringify(queryKey)
  useEffect(() => {
    if (!visible)
      queryClient.removeQueries({ queryKey: JSON.parse(key), exact: true })
  }, [visible, key])
  return visible
}
