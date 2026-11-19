import { NativeIdentificationCameraView } from '@/modules/native-identification-camera'
import { useNativeCameraCapture } from '@/src/hooks/useNativeCameraCapture'
import * as ImagePicker from 'expo-image-picker'
import { Stack } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  CameraFlashOverlay,
  CameraPermissionGate,
  CameraShutterRow,
  CameraThumbnailStrip,
  CameraTopBar,
} from './CameraChrome'
import { styles } from './index.styles'

export function NativeCameraScreen() {
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
    handleCameraDiagnostic,
    diagnostics,
    isActive,
    maxDetail,
    motionPriority,
    disableLowLightBoost,
    subjectMetering,
    pinchZoom,
    flashOverlayStyle,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    focus,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  } = useNativeCameraCapture()

  // The preview fills the screen, so its measured size converts a tap into the
  // normalized coordinates the native view expects. Layout changes are rare, so
  // this is state rather than a ref.
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 })
  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setPreviewSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    )
  }, [])

  // Tap to focus. The native view's pinch-to-zoom handling must keep working,
  // so the two gestures run simultaneously — the same arrangement
  // LegacyCameraScreen uses for tap-to-capture alongside VisionCamera's own
  // zoom gesture.
  const focusTapGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Tap()
          .runOnJS(true)
          .onEnd((event) => {
            const { width, height } = previewSize
            if (width <= 0 || height <= 0) return
            void focus({
              x: event.x / width,
              y: event.y / height,
            })
          }),
      ),
    [focus, previewSize],
  )

  if (!permission?.granted)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraPermissionGate onRequestPermission={requestPermission} />
      </>
    )

  return (
    <View style={styles.root} onLayout={handlePreviewLayout}>
      <Stack.Screen options={{ headerShown: false }} />
      <GestureDetector gesture={focusTapGesture}>
        <NativeIdentificationCameraView
          ref={cameraRef}
          style={styles.cameraFill}
          isActive={isActive}
          position={position}
          maxDetail={maxDetail}
          motionPriority={motionPriority}
          disableLowLightBoost={disableLowLightBoost}
          subjectMetering={subjectMetering}
          pinchZoom={pinchZoom}
          diagnostics={diagnostics}
          onCameraReady={handleCameraReady}
          onCameraDiagnostic={handleCameraDiagnostic}
          onCameraError={(event) => {
            setIsCameraReady(false)
            console.error(
              '[NativeCameraScreen]',
              event.nativeEvent?.message ?? 'Native camera error',
            )
          }}
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
        <CameraThumbnailStrip
          listRef={listRef}
          photos={capturedPhotos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
        />
        <CameraShutterRow
          onFlip={flipCamera}
          onCapture={handleTakePhoto}
          busy={isTakingPhoto || !isCameraReady}
          disabled={isTakingPhoto || !isCameraReady}
          shutterLabel="Capture photo"
        />
      </View>
    </View>
  )
}
