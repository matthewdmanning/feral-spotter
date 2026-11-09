import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { organizationRequest } from '@/src/features/organizations/lib/api'
import type { SharedSighting } from '@/src/shared/types/Organizations'

export type { SharedSighting }

/** No persistence: blur, background, loss of connectivity or an account change clears results. */
export function useSharedSightings(organizationId: string) {
  const uid = useAuthStore((s) => s.user?.uid)
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const online = useUIStore((s) => s.isOnline)
  const generation = useRef(0)
  const loadedPages = useRef(1)
  const [state, setState] = useState<{
    organizationId?: string
    uid?: string
    sightings: SharedSighting[]
    cursor?: string | null
    error: string
    busy: boolean
  }>({ sightings: [], error: '', busy: false })
  const load = useCallback(
    async (cursor?: string, append = false) => {
      const ticket = ++generation.current
      if (!uid || !online || !enabled || !organizationId) {
        setState({ sightings: [], error: '', busy: false })
        return
      }
      setState((previous) => ({ ...previous, busy: true, error: '' }))
      try {
        const sightings: SharedSighting[] = []
        let nextCursor: string | null | undefined = cursor
        let pages = 0
        const requestedPages = append ? 1 : loadedPages.current
        do {
          const result: { sightings: SharedSighting[]; cursor: string | null } =
            await organizationRequest<{
              sightings: SharedSighting[]
              cursor: string | null
            }>(
              {
                action: 'sharedSightings',
                organizationId,
                ...(nextCursor ? { cursor: nextCursor } : {}),
              },
              uid,
            )
          if (generation.current !== ticket) return
          sightings.push(...result.sightings)
          nextCursor = result.cursor
          pages++
        } while (nextCursor && (pages < requestedPages || !sightings.length))
        loadedPages.current = append ? loadedPages.current + pages : pages
        if (generation.current === ticket)
          setState((previous) => ({
            uid,
            organizationId,
            sightings: append
              ? [
                  ...new Map(
                    [...previous.sightings, ...sightings].map((s) => [s.id, s]),
                  ).values(),
                ]
              : sightings,
            cursor: nextCursor,
            busy: false,
            error: '',
          }))
      } catch {
        if (generation.current === ticket)
          setState({
            uid,
            organizationId,
            sightings: [],
            busy: false,
            error:
              'Shared Sightings are unavailable. Check your connection and membership, then retry.',
          })
      }
    },
    [uid, online, enabled, organizationId],
  )
  useFocusEffect(
    useCallback(() => {
      loadedPages.current = 1
      void load()
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load()
        else {
          generation.current++
          setState({ sightings: [], error: '', busy: false })
        }
      })
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') void load()
      }, 30_000)
      return () => {
        generation.current++
        subscription.remove()
        clearInterval(interval)
        setState({ sightings: [], error: '', busy: false })
      }
    }, [load]),
  )
  return {
    ...state,
    sightings:
      uid === state.uid &&
      organizationId === state.organizationId &&
      online &&
      enabled
        ? state.sightings
        : [],
    load,
    online,
    uid,
  }
}
