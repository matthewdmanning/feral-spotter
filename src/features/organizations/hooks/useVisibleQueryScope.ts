import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Visible scopes per client and query key. Two screens can show one query
 * (the organizations list and an organization both read memberships); the
 * data leaves memory only when the last of them stops being visible.
 */
const visibleScopes = new WeakMap<QueryClient, Map<string, number>>()

/** Organization data is memory-only: blur, backgrounding or unavailability drops it from the cache. */
export function useVisibleQueryScope(queryKey: QueryKey, available: boolean) {
  const queryClient = useQueryClient()
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
    if (!visible) return
    let scopes = visibleScopes.get(queryClient)
    if (!scopes) {
      scopes = new Map()
      visibleScopes.set(queryClient, scopes)
    }
    const counts = scopes
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return () => {
      const left = (counts.get(key) ?? 1) - 1
      if (left > 0) {
        counts.set(key, left)
        return
      }
      counts.delete(key)
      // Navigation blurs one screen before it focuses the next; wait that
      // one tick so a screen taking over the query keeps its data.
      setTimeout(() => {
        if (!counts.get(key))
          queryClient.removeQueries({ queryKey: JSON.parse(key), exact: true })
      }, 0)
    }
  }, [queryClient, visible, key])
  return visible
}
