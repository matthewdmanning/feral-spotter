import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  organizationRequest,
  organizationErrorMessage,
  isRequestCancelled,
  OrganizationSyncError,
} from '@/src/features/organizations/lib/api'
import { useOrganizationSharingStore } from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import type { MembershipList } from '@/functions/src/organizations/membership/domain'

export function useMemberships() {
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const generation = useRef(0)
  const visible = useRef(false)
  const pending = useRef<{
    uid: string
    mutation: boolean
    controller: AbortController
  } | null>(null)
  const [state, setState] = useState<
    MembershipList & {
      uid?: string
      error: string
      busy: boolean
      loaded: boolean
    }
  >({ memberships: [], error: '', busy: false, loaded: false })
  const request = useCallback(
    async (body: Record<string, unknown> = { action: 'memberships' }) => {
      if (!uid || !online || pending.current?.uid === uid) return false
      const ticket = ++generation.current
      const mutation = body.action !== 'memberships'
      const operation = { uid, mutation, controller: new AbortController() }
      pending.current = operation
      setState((previous) => ({ ...previous, busy: true, error: '' }))
      try {
        const result = await organizationRequest<MembershipList>(
          body,
          uid,
          mutation ? {} : { signal: operation.controller.signal },
        )
        if (!Array.isArray(result.memberships))
          throw new Error('Invalid membership response')
        // Apply acknowledged permission outcomes even if the user left this screen during the write.
        if (
          result.ledger &&
          typeof body.organizationId === 'string' &&
          result.memberships.some(
            (member) =>
              member.organizationId === body.organizationId &&
              ['left', 'removed'].includes(member.status) &&
              !member.leaving,
          )
        )
          useOrganizationSharingStore
            .getState()
            .acceptLedger(uid, body.organizationId, result.ledger)
        if (
          visible.current &&
          useAuthStore.getState().user?.uid === uid &&
          (mutation || ticket === generation.current)
        )
          setState({
            uid,
            memberships: result.memberships,
            error: '',
            busy: false,
            loaded: true,
          })
        return true
      } catch (error) {
        let memberships: MembershipList['memberships'] | undefined
        // A lost mutation response is ambiguous: reconcile the durable server checkpoint first.
        if (
          mutation &&
          !isRequestCancelled(error) &&
          useAuthStore.getState().user?.uid === uid
        ) {
          try {
            const reconciled = await organizationRequest<MembershipList>(
              {
                action: 'memberships',
                includePermissions: [
                  'leaveOrganization',
                  'resumeLeaving',
                ].includes(String(body.action)),
              },
              uid,
            )
            memberships = reconciled.memberships
            if (
              reconciled.ledger &&
              typeof body.organizationId === 'string' &&
              reconciled.memberships.some(
                (member) =>
                  member.organizationId === body.organizationId &&
                  ['left', 'removed'].includes(member.status) &&
                  !member.leaving,
              )
            )
              useOrganizationSharingStore
                .getState()
                .acceptLedger(uid, body.organizationId, reconciled.ledger)
          } catch {
            /* Keep failure actionable; the next refresh can reconcile. */
          }
        }
        if (
          visible.current &&
          useAuthStore.getState().user?.uid === uid &&
          !isRequestCancelled(error)
        )
          setState((previous) => ({
            uid,
            memberships:
              error instanceof OrganizationSyncError &&
              [401, 403].includes(error.status)
                ? []
                : (memberships ?? (mutation ? previous.memberships : [])),
            busy: false,
            loaded: true,
            error: organizationErrorMessage(error),
          }))
        return false
      } finally {
        if (pending.current === operation) pending.current = null
      }
    },
    [uid, online],
  )
  useFocusEffect(
    useCallback(() => {
      visible.current = true
      void request()
      const clear = () => {
        generation.current++
        if (!pending.current?.mutation) {
          pending.current?.controller.abort()
          pending.current = null
        }
        setState({ memberships: [], error: '', busy: false, loaded: false })
      }
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          visible.current = true
          void request()
        } else {
          visible.current = false
          clear()
        }
      })
      return () => {
        visible.current = false
        clear()
        listener.remove()
      }
    }, [request]),
  )
  const current = state.uid === uid
  const initialLoading =
    !!uid && online && (!current || !state.loaded) && !state.error
  return {
    ...state,
    memberships: current && online ? state.memberships : [],
    busy: state.busy || initialLoading,
    initialLoading,
    uid,
    online,
    request,
  }
}
