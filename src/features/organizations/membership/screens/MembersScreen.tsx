import { useCallback, useRef, useState } from 'react'
import { AppState, ScrollView, Text } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { organizationRequest } from '../../lib/api'
import { styles } from '../../components/styles'
import { styles as layout } from '../components/styles'

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const uid = useAuthStore((s) => s.user?.uid)
  const online = useUIStore((s) => s.isOnline)
  const generation = useRef(0)
  const [result, setResult] = useState<{
    uid?: string
    members: { displayName: string }[]
  }>({ members: [] })
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    const ticket = ++generation.current
    setResult({ members: [] })
    setError('')
    if (!uid || !online) return
    try {
      const response = await organizationRequest<{
        members: { displayName: string }[]
      }>({ action: 'organizationMembers', organizationId: id }, uid)
      if (ticket === generation.current)
        setResult({ uid, members: response.members })
    } catch {
      if (ticket === generation.current)
        setError(
          'Members are unavailable. Check your connection and membership, then retry.',
        )
    }
  }, [id, uid, online])
  useFocusEffect(
    useCallback(() => {
      void refresh()
      const clear = () => {
        generation.current++
        setResult({ members: [] })
      }
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh()
        else clear()
      })
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') void refresh()
      }, 30_000)
      return () => {
        clear()
        listener.remove()
        clearInterval(interval)
      }
    }, [refresh]),
  )
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Stack.Screen options={{ title: 'Members' }} />
      <Text style={styles.hint}>
        Only display names are shared in this list.
      </Text>
      {!online && <Text style={styles.body}>Connect to view members.</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
      <AppButton
        disabled={!online}
        onPress={() => {
          void refresh()
        }}
      >
        Refresh members
      </AppButton>
      {uid === result.uid &&
        online &&
        result.members.map((member, index) => (
          <Text key={index} style={styles.body}>
            {member.displayName}
          </Text>
        ))}
    </ScrollView>
  )
}
