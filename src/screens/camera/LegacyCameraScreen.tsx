import {
  useCameraCapture,
  type CaptureMode,
} from '@/src/hooks/useCameraCapture'
import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import { Stack } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet as RNStyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Camera, useCameraPermission } from 'react-native-vision-camera'
import {
  CameraFlashOverlay,
  CameraGate,
  CameraPermissionGate,
  CameraShutterRow,
  CameraThumbnailStrip,
  CameraTopBar,
} from './CameraChrome'
import { styles } from './index.styles'

const CAPTURE_MODES: { value: CaptureMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'burst', label: 'Burst' },
]

function shutterLabelFor(captureMode: CaptureMode, isTakingPhoto: boolean) {
  if (captureMode !== 'burst') return 'Capture photo'
  return isTakingPhoto ? 'Stop burst' : 'Start burst'
}

export function LegacyCameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission()
  const {
    device,
    cameraRef,
    photoOutput,
    isActive,
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
        <CameraPermissionGate onRequestPermission={requestPermission} />
      </>
    )

  if (!device)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraGate
          title="No Camera Found"
          primaryLabel="Go Back"
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
            label="Capture"
            options={CAPTURE_MODES}
            value={captureMode}
            onChange={(mode) => mode && setCaptureMode(mode)}
            accessibilityLabel="Capture mode"
          />
          {captureMode === 'burst' && (
            <Text style={styles.captureModeHint}>
              {isTakingPhoto
                ? 'Tap preview or shutter to stop'
                : 'Tap preview or shutter to start'}
            </Text>
          )}
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
          disabled={captureMode === 'single' && isTakingPhoto}
          shutterLabel={shutterLabelFor(captureMode, isTakingPhoto)}
        />
      </View>
    </View>
  )
}
