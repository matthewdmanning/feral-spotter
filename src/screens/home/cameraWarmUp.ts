import { prewarmCamera } from '@/modules/native-identification-camera'

/**
 * Prepares the Camera screen while Home sits idle, so the first tap on Take
 * Photos does less work before the shutter is ready.
 *
 * - The native camera stack starts (Android: CameraX enumerates the cameras).
 *   No camera opens and nothing streams.
 * - The Camera screen's JavaScript is evaluated. Expo Router loads a route's
 *   module only on its first visit, so without this the camera code — capture
 *   hooks, upload, gallery save — runs between the tap and the first frame.
 *
 * Only the module is evaluated; the screen is not rendered. A prefetched render
 * would run the screen's mount effects, which log a camera-open event and start
 * the Live fix before the user has opened the camera.
 *
 * Returns a function that cancels the warm-up if it has not run yet.
 */
export function scheduleCameraWarmUp(): () => void {
  const handle = requestIdleCallback(() => {
    prewarmCamera()
    void import('@/src/screens/camera')
  })
  return () => cancelIdleCallback(handle)
}
