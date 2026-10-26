import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { AppButton, type ColumnButton } from '@/src/components/atoms/AppButton'
import { BottomButtonColumn } from '@/src/components/molecules/BottomButtonColumn'
import { ENTRYPOINT_BUFFER_PERCENT } from '@/src/config/constants'
import { useEntryGate } from '@/src/hooks/useEntryGate'
import { useLibraryPhotoPicker } from '@/src/hooks/useLibraryPhotoPicker'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useResumableDraft } from '@/src/hooks/useResumableDraft'
import { computeEntrypointDiameter } from '@/src/lib/home/entrypointDiameter'
import { Stack, router } from 'expo-router'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera'
import { ImageSquareIcon } from 'phosphor-react-native/src/icons/ImageSquare'
import { useCallback, useMemo } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

/**
 * Camera-viewfinder corner reticle, inset within a circular entrypoint
 * button — the "spotting" motif. Decorative only (pointerEvents="none").
 */
function ViewfinderCorners({
  diameter,
  color,
}: {
  diameter: number
  color: string
}) {
  const { theme } = useUnistyles()
  const inset = diameter * 0.16
  const size = diameter * 0.12
  const thickness = theme.reticle.thickness
  // Rounded bends soften the reticle from a hard crop mark into a friendly
  // viewfinder.
  const bend = size * 0.4
  const corners = [
    {
      top: inset,
      left: inset,
      borderTopWidth: thickness,
      borderLeftWidth: thickness,
      borderTopLeftRadius: bend,
    },
    {
      top: inset,
      right: inset,
      borderTopWidth: thickness,
      borderRightWidth: thickness,
      borderTopRightRadius: bend,
    },
    {
      bottom: inset,
      left: inset,
      borderBottomWidth: thickness,
      borderLeftWidth: thickness,
      borderBottomLeftRadius: bend,
    },
    {
      bottom: inset,
      right: inset,
      borderBottomWidth: thickness,
      borderRightWidth: thickness,
      borderBottomRightRadius: bend,
    },
  ] as const

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {corners.map((corner, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderColor: color,
            opacity: theme.reticle.opacity,
            ...corner,
          }}
        />
      ))}
    </View>
  )
}

interface EntrypointCircleProps {
  label: string
  Icon: PhosphorIcon
  variant: 'primary' | 'secondary'
  diameter: number
  disabled: boolean
  onPress: () => void
}

/** One circular entrypoint: the button, its icon, and the reticle frame. */
function EntrypointCircle({
  label,
  Icon,
  variant,
  diameter,
  disabled,
  onPress,
}: EntrypointCircleProps) {
  const { theme } = useUnistyles()
  // Icon and reticle take the label's color, so they match the variant.
  const color =
    variant === 'primary' ? theme.colors.accentText : theme.colors.onSecondary
  return (
    <View style={{ width: diameter, height: diameter }}>
      <AppButton
        onPress={onPress}
        variant={variant}
        size="circle"
        diameter={diameter}
        disabled={disabled}
        icon={<Icon size={theme.iconSize.xxl} color={color} />}
      >
        {label}
      </AppButton>
      <ViewfinderCorners diameter={diameter} color={color} />
    </View>
  )
}

export default function HomeScreen() {
  const { theme } = useUnistyles()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const isLandscape = screenWidth >= screenHeight
  const entrypointDiameter = computeEntrypointDiameter(
    screenWidth,
    screenHeight,
    ENTRYPOINT_BUFFER_PERCENT,
    theme.spacing.xxxl,
  )

  useEntryGate()
  const columnVisible = useResumableDraft()

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
          headerTitleStyle: {
            fontFamily: theme.fonts.extrabold,
            fontSize: theme.typography.xl,
            color: theme.colors.text,
          },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.root}>
        <AmbientBackground />
        <View
          style={[
            styles.entrypointArea,
            { flexDirection: isLandscape ? 'row' : 'column' },
          ]}
        >
          <EntrypointCircle
            label="Take Photos"
            Icon={CameraIcon}
            variant="primary"
            diameter={entrypointDiameter}
            disabled={cameraDisabled}
            onPress={handleCamera}
          />
          <EntrypointCircle
            label="Upload Photos"
            Icon={ImageSquareIcon}
            variant="secondary"
            diameter={entrypointDiameter}
            disabled={libraryDisabled}
            onPress={pickFromLibrary}
          />
        </View>

        {/* #375: one of the two circles above is dead whenever the pool has
            a source, and nothing said why. Only ever one is disabled, so
            one line covers both cases. */}
        {photoSource !== null && (
          <Text style={styles.disabledReason}>
            {photoSource === 'camera'
              ? 'This submission uses camera photos. Finish or reset it before you use Upload Photos.'
              : 'This submission uses library photos. Finish or reset it before you use Take Photos.'}
          </Text>
        )}

        <View style={styles.bottomArea}>
          <BottomButtonColumn buttons={buttons} visible={columnVisible} />
        </View>
      </View>
    </>
  )
}
