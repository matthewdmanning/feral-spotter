import { NativeIdentificationCameraView } from '@/modules/native-identification-camera'
import { useNativeCameraCapture } from '@/src/hooks/useNativeCameraCapture'
import * as ImagePicker from 'expo-image-picker'
import { Stack } from 'expo-router'
import { StyleSheet as RNStyleSheet, View } from 'react-native'
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

  if (!permission?.granted)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraPermissionGate onRequestPermission={requestPermission} />
      </>
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
