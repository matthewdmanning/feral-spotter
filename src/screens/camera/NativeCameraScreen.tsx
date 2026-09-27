import { NativeIdentificationCameraView } from '@/modules/native-identification-camera'
import { useNativeCameraCapture } from '@/src/hooks/useNativeCameraCapture'
import { FlashList } from '@shopify/flash-list'
import * as ImagePicker from 'expo-image-picker'
import { Stack } from 'expo-router'
import { SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native'
import { useCallback } from 'react'
import {
  Linking,
  Pressable,
  StyleSheet as RNStyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export function NativeCameraScreen() {
  const { theme } = useUnistyles()
  const [permission, requestPermission] = ImagePicker.useCameraPermissions()
  const {
    cameraRef,
    listRef,
    position,
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    isCameraReady,
    setIsCameraReady,
    handleCameraReady,
    isActive,
    maxDetail,
    motionPriority,
    disableLowLightBoost,
    subjectMetering,
    flashOverlayStyle,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  } = useNativeCameraCapture()

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

  if (!permission?.granted)
    return (
      <View style={styles.gate}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.gateTitle}>Camera Access Required</Text>
        <Text style={styles.gateBody}>
          FeralSpotter needs camera access to capture cat observations.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={styles.gatePrimary}
          accessibilityRole="button"
        >
          <Text style={styles.gatePrimaryText}>Allow Camera</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={styles.gateSecondary}
          accessibilityRole="button"
        >
          <Text style={styles.gateSecondaryText}>Open Settings</Text>
        </Pressable>
      </View>
    )

  const hasPhotos = capturedPhotos.length > 0
  const FlashIcon =
    flashMode === 'on' ? (
      <Zap size={22} color={theme.colors.warning} />
    ) : (
      <ZapOff size={22} color={theme.colors.text} />
    )

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <NativeIdentificationCameraView
        ref={cameraRef}
        style={RNStyleSheet.absoluteFill}
        isActive={isActive}
        position={position}
        maxDetail={maxDetail}
        motionPriority={motionPriority}
        disableLowLightBoost={disableLowLightBoost}
        subjectMetering={subjectMetering}
        onCameraReady={handleCameraReady}
        onCameraError={(event) => {
          setIsCameraReady(false)
          console.error(
            '[NativeCameraScreen]',
            event.nativeEvent?.message ?? 'Native camera error',
          )
        }}
      />
      <Animated.View
        style={[
          RNStyleSheet.absoluteFill,
          styles.flashOverlay,
          flashOverlayStyle,
        ]}
        pointerEvents="none"
      />

      <View style={styles.topBar}>
        <Pressable
          onPress={handleClose}
          style={styles.iconBtn}
          accessibilityRole="button"
        >
          <X size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.topBarRight}>
          {hasPhotos && (
            <Pressable
              onPress={handleDone}
              style={styles.pill}
              accessibilityRole="button"
            >
              <Text style={styles.pillText}>
                Done ({capturedPhotos.length})
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={cycleFlash}
            style={styles.iconBtn}
            accessibilityRole="button"
          >
            {FlashIcon}
            {flashMode === 'auto' && <Text style={styles.autoA}>A</Text>}
          </Pressable>
        </View>
      </View>

      <View style={styles.bottomBar}>
        {hasPhotos && (
          <FlashList
            ref={listRef}
            data={capturedPhotos}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}
            style={styles.strip}
          />
        )}
        <View style={styles.shutterRow}>
          <Pressable
            onPress={flipCamera}
            style={[styles.sideBtn, styles.sideBtnFilled]}
            accessibilityRole="button"
          >
            <SwitchCamera size={30} color={theme.colors.text} />
          </Pressable>
          <Animated.View style={shutterStyle}>
            <Pressable
              onPress={handleTakePhoto}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={isTakingPhoto || !isCameraReady}
              style={[
                styles.shutter,
                (isTakingPhoto || !isCameraReady) && styles.shutterBusy,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </Animated.View>
          <View style={styles.sideBtn} />
        </View>
      </View>
    </View>
  )
}
