import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  organizationRequest,
  organizationErrorMessage,
  isRequestCancelled,
} from '@/src/features/organizations/lib/api'

/** Common collection lifecycle; feature modules supply their endpoint and item shape. */
export function useOrganizationPager<T>({
  action,
  organizationId,
  itemsKey,
  enabled = true,
}: {
  action: string
  organizationId: string
  itemsKey: string
  enabled?: boolean
}) {
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const scope = `${uid ?? ''}/${organizationId}/${action}`
  const generation = useRef(0)
  const request = useRef<AbortController | null>(null)
  const loadedPages = useRef(1)
  const [state, setState] = useState<{
    scope: string
    items: T[]
    cursor?: string | null
    busy: boolean
    loaded: boolean
    error: string
  }>({ scope: '', items: [], busy: false, loaded: false, error: '' })
  const available = !!uid && online && enabled && !!organizationId
  const load = useCallback(
    async (cursor?: string, append = false) => {
      if (!uid || !online || !enabled || !organizationId || request.current)
        return
      const ticket = ++generation.current
      const controller = new AbortController()
      request.current = controller
      setState((previous) => ({ ...previous, busy: true, error: '' }))
      try {
        const items: T[] = []
        let nextCursor: string | null | undefined = cursor
        let pages = 0
        const requestedPages = append ? 1 : loadedPages.current
        do {
          const response: Record<string, unknown> = await organizationRequest(
            {
              action,
              organizationId,
              ...(nextCursor ? { cursor: nextCursor } : {}),
            },
            uid,
            { signal: controller.signal },
          )
          if (ticket !== generation.current) return
          if (
            !Array.isArray(response[itemsKey]) ||
            (response.cursor != null && typeof response.cursor !== 'string')
          )
            throw new Error('Invalid collection response')
          items.push(...(response[itemsKey] as T[]))
          nextCursor = response.cursor as string | null | undefined
          pages++
        } while (nextCursor && (pages < requestedPages || !items.length))
        loadedPages.current = append ? loadedPages.current + pages : pages
        if (ticket === generation.current)
          setState((previous) => ({
            scope,
            items:
              append && previous.scope === scope
                ? [...previous.items, ...items]
                : items,
            cursor: nextCursor,
            busy: false,
            loaded: true,
            error: '',
          }))
      } catch (error) {
        if (ticket === generation.current && !isRequestCancelled(error))
          setState({
            scope,
            items: [],
            busy: false,
            loaded: true,
            error: organizationErrorMessage(error),
          })
      } finally {
        if (request.current === controller) request.current = null
      }
    },
    [uid, online, enabled, organizationId, action, itemsKey, scope],
  )
  useFocusEffect(
    useCallback(() => {
      loadedPages.current = 1
      void load()
      const clear = () => {
        generation.current++
        request.current?.abort()
        request.current = null
        setState({
          scope: '',
          items: [],
          busy: false,
          loaded: false,
          error: '',
        })
      }
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load()
        else clear()
      })
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') void load()
      }, 30000)
      return () => {
        clear()
        listener.remove()
        clearInterval(interval)
      }
    }, [load]),
  )
  const current = state.scope === scope
  const initialLoading =
    available && (!current || !state.loaded) && !state.error
  return {
    items: available && current ? state.items : [],
    cursor: available && current ? state.cursor : null,
    error: current ? state.error : '',
    busy: state.busy || initialLoading,
    initialLoading,
    loaded: current && state.loaded,
    online,
    uid,
    enabled,
    load,
  }
}
