import { AppButton, type ColumnButton } from '@/src/components/atoms/AppButton'
import { BottomButtonColumn } from '@/src/components/molecules/BottomButtonColumn'
import { SUBMISSION_STALE_MS } from '@/src/config/constants'
import { hasAcceptedConsent } from '@/src/hooks/useConsentStore'
import { useLibraryPhotoPicker } from '@/src/hooks/useLibraryPhotoPicker'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useAuth } from '@/src/lib/auth/useAuth'
import { getAllSubmissionCaches } from '@/src/lib/cache/submissionCache'
import { Stack, router } from 'expo-router'
import { Camera, ImagePlus } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export default function HomeScreen() {
  const { theme } = useUnistyles()
  const { isAuthenticated, isReady } = useAuth()

  // App-wide gate: no device consent yet → intro flow (onboarding leads into
  // consent); consent already accepted but not signed in → sign-in; otherwise
  // render normal home. Consent is checked first so a consented-but-signed-out
  // user (e.g. after logging out) never sees intro-flow/consent again — that
  // gate is granted for the device, not the session. Never act while
  // !isReady — auth state is indeterminate until the provider has reported
  // at least once, and redirecting on a guess is what caused #93's loop.
  useEffect(() => {
    if (!isReady) return
    if (!hasAcceptedConsent()) {
      router.replace('/intro-flow')
    } else if (!isAuthenticated) {
      router.replace('/sign-in')
    }
  }, [isReady, isAuthenticated])

  const [columnVisible, setColumnVisible] = useState(false)
  useEffect(() => {
    getAllSubmissionCaches().then((caches) => {
      const latest = caches[0]
      const isStale =
        latest &&
        Date.now() - new Date(latest.updated_at).getTime() > SUBMISSION_STALE_MS
      setColumnVisible(!!latest && latest.status === 'In Progress' && !isStale)
    })
  }, [])

  // A draft is single-source by construction (ADR 0002 amendment): once the
  // shared pool holds a photo, the entrypoint for the *other* source is
  // disabled until the draft is submitted or reset (pool cleared).
  const photoSource = usePhotoStore((s) => s.source)
  const cameraDisabled = photoSource === 'library'
  const libraryDisabled = photoSource === 'camera'

  const { pickFromLibrary } = useLibraryPhotoPicker()

  const handleCamera = useCallback(() => router.navigate('/camera'), [])
  const handleNew = useCallback(() => router.push('/submission/create'), [])
  const handleContinue = useCallback(
    () => router.push('/submission/create'),
    [],
  )

  const buttons = useMemo<ColumnButton[]>(
    () => [
      {
        key: 'continue',
        label: 'Continue Observation',
        onPress: handleContinue,
        variant: 'primary',
      },
      {
        key: 'new',
        label: 'New Sighting',
        onPress: handleNew,
        variant: 'secondary',
      },
    ],
    [handleContinue, handleNew],
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'FeralSpotter',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '700', color: theme.colors.text },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.root}>
        <View style={styles.entrypointArea}>
          <AppButton
            onPress={handleCamera}
            variant="primary"
            size="large"
            disabled={cameraDisabled}
            icon={<Camera size={48} color={theme.colors.accentText} />}
            accessibilityLabel="Take a Photo"
          >
            Take a Photo
          </AppButton>
          <AppButton
            onPress={pickFromLibrary}
            variant="secondary"
            size="large"
            disabled={libraryDisabled}
            icon={<ImagePlus size={48} color={theme.colors.text} />}
            accessibilityLabel="Choose from Library"
          >
            Choose from Library
          </AppButton>
        </View>

        <BottomButtonColumn
          buttons={buttons}
          visible={columnVisible}
          spacing={12}
          paddingBottom={16}
        />
      </View>
    </>
  )
}
