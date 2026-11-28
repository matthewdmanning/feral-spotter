import { cameraCopy, commonCopy } from '@/src/shared/config/text'
import {
  useCameraCapture,
  type CaptureMode,
} from '@/src/features/camera-control/hooks/useCameraCapture'
import { SegmentedControl } from '@/src/shared/ui/atoms/SegmentedControl'
import { GateScreen } from '@/src/shared/ui/molecules/GateScreen'
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet as RNStyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Camera, useCameraPermission } from 'react-native-vision-camera'
import {
  CameraFlashOverlay,
  CameraPermissionGate,
  CameraShutterRow,
  CameraThumbnailStrip,
  CameraTopBar,
} from './CameraChrome'
import { styles } from './index.styles'

const CAPTURE_MODES: { value: CaptureMode; label: string }[] = [
  { value: 'single', label: cameraCopy.modes.single },
  { value: 'burst', label: cameraCopy.modes.burst },
]

function shutterLabelFor(captureMode: CaptureMode, isTakingPhoto: boolean) {
  if (captureMode !== 'burst') return cameraCopy.capturePhoto
  return isTakingPhoto ? cameraCopy.stopBurst : cameraCopy.startBurst
}

export function LegacyCameraScreen() {
  const { hasPermission, requestPermission, status, canRequestPermission } =
    useCameraPermission()
  const {
    device,
    cameraRef,
    photoOutput,
    isActive,
    canCapture,
    enableLowLightBoost,
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    captureMode,
    flashOverlayStyle,
    listRef,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    handleCameraConfigured,
    setCaptureMode,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  } = useCameraCapture()

  // A tap on the preview captures, and the native gesture still has to reach
  // VisionCamera's own zoom handling, so the two run simultaneously.
  const cameraTapGesture = useMemo(() => {
    const nativeGesture = Gesture.Native()
    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        void handleTakePhoto()
      })
    return Gesture.Simultaneous(nativeGesture, tapGesture)
  }, [handleTakePhoto])

  if (!hasPermission)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraPermissionGate
          askOnOpen={status === 'not-determined'}
          canAsk={canRequestPermission}
          onRequestPermission={requestPermission}
        />
      </>
    )

  if (!device)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <GateScreen
          title={cameraCopy.noCamera}
          primaryLabel={commonCopy.goBack}
          onPrimary={handleClose}
        />
      </>
    )

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <GestureDetector gesture={cameraTapGesture}>
        <Camera
          ref={cameraRef}
          style={RNStyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          outputs={[photoOutput]}
          onConfigured={handleCameraConfigured}
          enableLowLightBoost={enableLowLightBoost}
          enableNativeZoomGesture
        />
      </GestureDetector>
      <CameraFlashOverlay style={flashOverlayStyle} />

      <CameraTopBar
        photoCount={capturedPhotos.length}
        flashMode={flashMode}
        onClose={handleClose}
        onDone={handleDone}
        onCycleFlash={cycleFlash}
      />

      <View style={styles.bottomBar}>
        <View
          style={styles.captureModeControl}
          pointerEvents={isTakingPhoto ? 'none' : 'auto'}
        >
          <SegmentedControl
            label={cameraCopy.captureMode}
            options={CAPTURE_MODES}
            value={captureMode}
            onChange={(mode) => mode && setCaptureMode(mode)}
            accessibilityLabel={cameraCopy.captureModeAccessibility}
          />
        </View>
        <CameraThumbnailStrip
          listRef={listRef}
          photos={capturedPhotos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
        />
        <CameraShutterRow
          onFlip={flipCamera}
          onCapture={handleTakePhoto}
          busy={isTakingPhoto}
          disabled={!canCapture || (captureMode === 'single' && isTakingPhoto)}
          shutterLabel={shutterLabelFor(captureMode, isTakingPhoto)}
        />
      </View>
    </View>
  )
}
