import { create } from 'zustand'
import Constants from 'expo-constants'
import { randomUUID } from 'expo-crypto'
import { asyncStorage } from '@/src/lib/cache/storage'

interface FlagState {
  enabled: boolean
  refresh: () => Promise<void>
}
let inFlight: Promise<void> | null = null
/** Evaluates flags without starting the analytics SDK or sending capture/identify events. */
export const useOrganizationsFlag = create<FlagState>((set) => ({
  enabled: false,
  refresh: () => {
    if (inFlight) return inFlight
    inFlight = (async () => {
      try {
        const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as
          string | undefined
        const host = Constants.expoConfig?.extra?.posthogHost as
          string | undefined
        if (!apiKey || !host) {
          set({ enabled: false })
          return
        }
        let distinctId = await asyncStorage.getItem(
          'organizations-flag-installation',
        )
        if (!distinctId) {
          distinctId = randomUUID()
          await asyncStorage.setItem(
            'organizations-flag-installation',
            distinctId,
          )
        }
        const cached = await asyncStorage.getItem('organizations-flag-v1')
        let cachedEnabled = false
        if (cached) {
          try {
            const previous = JSON.parse(cached) as {
              enabled: boolean
              checkedAt: number
            }
            cachedEnabled =
              previous.enabled === true &&
              previous.checkedAt <= Date.now() &&
              Date.now() - previous.checkedAt < 24 * 60 * 60 * 1000
          } catch {
            /* Ignore a corrupt cache and still request the current flag. */
          }
        }
        set({ enabled: cachedEnabled })
        const response = await fetch(`${host.replace(/\/$/, '')}/flags/?v=2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: apiKey,
            distinct_id: distinctId,
            geoip_disable: true,
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw new Error('Flag evaluation failed')
        const result = (await response.json().catch(() => null)) as {
          flags?: Record<string, { enabled?: boolean }>
          errorsWhileComputingFlags?: boolean
        } | null
        const enabled =
          result?.errorsWhileComputingFlags !== true &&
          result?.flags?.Organizations?.enabled === true
        set({ enabled })
        await asyncStorage.setItem(
          'organizations-flag-v1',
          JSON.stringify({ enabled, checkedAt: Date.now() }),
        )
      } catch {
        /* Fresh cached evaluation remains usable offline; initial state is off. */
      }
    })().finally(() => {
      inFlight = null
    })
    return inFlight
  },
}))
