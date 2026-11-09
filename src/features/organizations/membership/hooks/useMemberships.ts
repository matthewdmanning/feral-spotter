import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { organizationRequest, OrganizationSyncError } from '../../lib/api'
import { useOrganizationSharingStore } from '../../hooks/useOrganizationSharingStore'
import type { MembershipList } from '@/functions/src/organizations/membership/domain'

export function useMemberships() {
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const generation = useRef(0)
  const [state, setState] = useState<
    MembershipList & { uid?: string; error: string; busy: boolean }
  >({ memberships: [], error: '', busy: false })
  const request = useCallback(
    async (body: Record<string, unknown> = { action: 'memberships' }) => {
      const ticket = ++generation.current
      if (!uid || !online) return false
      setState((previous) => ({ ...previous, busy: true, error: '' }))
      try {
        const result = await organizationRequest<MembershipList>(body, uid)
        if (generation.current !== ticket) return false
        if (result.ledger && typeof body.organizationId === 'string')
          useOrganizationSharingStore
            .getState()
            .acceptLedger(uid, body.organizationId, result.ledger)
        setState({
          uid,
          memberships: result.memberships,
          error: '',
          busy: false,
        })
        return true
      } catch (error) {
        if (generation.current === ticket)
          setState((previous) => ({
            ...previous,
            busy: false,
            error:
              error instanceof OrganizationSyncError && error.status === 409
                ? 'Choices changed. Refresh and review again, or resume the pending leave operation.'
                : 'Unable to complete this request. Check your connection and retry.',
          }))
        return false
      }
    },
    [uid, online],
  )
  useFocusEffect(
    useCallback(() => {
      void request()
      const clear = () => {
        generation.current++
        setState({ memberships: [], error: '', busy: false })
      }
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void request()
        else clear()
      })
      return () => {
        clear()
        listener.remove()
      }
    }, [request]),
  )
  return {
    ...state,
    memberships: state.uid === uid && online ? state.memberships : [],
    uid,
    online,
    request,
  }
}
