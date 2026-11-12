/**
 * The camera screen's chrome, shared by both backends' screens.
 *
 * Both screens render the same permission gate, top bar, thumbnail strip,
 * shutter row and flash overlay. Holding two copies had already cost an
 * accessibility label: the legacy screen labelled its shutter and the native
 * one did not. The shutter's label is a required prop here, so a screen cannot
 * ship without one.
 *
 * Only the preview itself differs between the two screens, because only the
 * preview is backend-specific.
 */

import { GateScreen } from '@/src/shared/ui/molecules/GateScreen'
import type { SubmissionPhoto } from '@/src/shared/types'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { CameraRotateIcon } from 'phosphor-react-native/src/icons/CameraRotate'
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning'
import { LightningSlashIcon } from 'phosphor-react-native/src/icons/LightningSlash'
import { XIcon } from 'phosphor-react-native/src/icons/X'
import { useCallback } from 'react'
import {
  Pressable,
  StyleSheet as RNStyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export const CAMERA_PERMISSION_GATE_BODY =
  'FeralSpotter needs camera access to capture cat observations.'

export function CameraPermissionGate({
  onRequestPermission,
}: {
  onRequestPermission: () => void
}) {
  return (
    <GateScreen
      title="Camera Access Required"
      body={CAMERA_PERMISSION_GATE_BODY}
      primaryLabel="Allow Camera"
      onPrimary={onRequestPermission}
      showOpenSettings
    />
  )
}

export function CameraFlashOverlay({
  style,
}: {
  style: ReturnType<typeof useAnimatedStyle<ViewStyle>>
}) {
  return (
    <Animated.View
      style={[RNStyleSheet.absoluteFill, styles.flashOverlay, style]}
      pointerEvents="none"
    />
  )
}

interface CameraTopBarProps {
  photoCount: number
  flashMode: 'off' | 'on' | 'auto'
  onClose: () => void
  onDone: () => void
  onCycleFlash: () => void
}

export function CameraTopBar({
  photoCount,
  flashMode,
  onClose,
  onDone,
  onCycleFlash,
}: CameraTopBarProps) {
  const { theme } = useUnistyles()

  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onClose}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Close camera"
      >
        <XIcon size={theme.iconSize.lg} color={theme.colors.text} />
      </Pressable>
      <View style={styles.topBarRight}>
        {photoCount > 0 && (
          <Pressable
            onPress={onDone}
            style={styles.pill}
            accessibilityRole="button"
          >
            <Text style={styles.pillText}>Done ({photoCount})</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onCycleFlash}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={`Flash ${flashMode}`}
        >
          {flashMode === 'on' ? (
            <LightningIcon
              size={theme.iconSize.lg}
              color={theme.colors.warning}
            />
          ) : (
            <LightningSlashIcon
              size={theme.iconSize.lg}
              color={theme.colors.text}
            />
          )}
          {flashMode === 'auto' && <Text style={styles.autoA}>A</Text>}
        </Pressable>
      </View>
    </View>
  )
}

interface CameraThumbnailStripProps {
  listRef: React.RefObject<FlashListRef<SubmissionPhoto> | null>
  photos: SubmissionPhoto[]
  renderItem: (info: {
    item: SubmissionPhoto
    index: number
  }) => React.ReactElement
  keyExtractor: (item: SubmissionPhoto) => string
}

export function CameraThumbnailStrip({
  listRef,
  photos,
  renderItem,
  keyExtractor,
}: CameraThumbnailStripProps) {
  if (photos.length === 0) return null

  return (
    <FlashList
      ref={listRef}
      data={photos}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stripContent}
      style={styles.strip}
    />
  )
}

interface CameraShutterRowProps {
  onFlip: () => void
  onCapture: () => void
  /** True while a capture is running, which styles the shutter as busy. */
  busy: boolean
  /** True when the shutter cannot be pressed at all. */
  disabled: boolean
  /** Required: the native screen shipped without one while this was duplicated. */
  shutterLabel: string
}

export function CameraShutterRow({
  onFlip,
  onCapture,
  busy,
  disabled,
  shutterLabel,
}: CameraShutterRowProps) {
  const { theme } = useUnistyles()

  const shutterScale = useSharedValue(1)
  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }))
  const onPressIn = useCallback(() => {
    shutterScale.value = withTiming(0.88, {
      duration: 70,
      easing: Easing.out(Easing.quad),
    })
  }, [shutterScale])
  const onPressOut = useCallback(() => {
    shutterScale.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.back(1.5)),
    })
  }, [shutterScale])

  return (
    <View style={styles.shutterRow}>
      <Pressable
        onPress={onFlip}
        style={[styles.sideBtn, styles.sideBtnFilled]}
        accessibilityRole="button"
        accessibilityLabel="Switch camera"
      >
        <CameraRotateIcon size={theme.iconSize.lg} color={theme.colors.text} />
      </Pressable>
      <Animated.View style={shutterStyle}>
        <Pressable
          onPress={onCapture}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled}
          style={[styles.shutter, busy && styles.shutterBusy]}
          accessibilityRole="button"
          accessibilityLabel={shutterLabel}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </Animated.View>
      <View style={styles.sideBtn} />
    </View>
  )
}
