package expo.modules.nativeidentificationcamera

import android.app.Application
import android.content.Context
import android.util.Log
import androidx.annotation.OptIn
import androidx.camera.camera2.Camera2Config
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraXConfig
import androidx.camera.lifecycle.ExperimentalCameraProviderConfiguration
import androidx.camera.lifecycle.ProcessCameraProvider
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/**
 * Registers app-level setup for this module. Expo autolinking finds this class
 * by its file name and its `Package` import, so both have to stay as they are.
 */
class NativeIdentificationCameraPackage : Package {
  override fun createApplicationLifecycleListeners(
    context: Context
  ): List<ApplicationLifecycleListener> = listOf(CameraXConfigListener())
}

/**
 * Limits CameraX to the back camera before anything starts it.
 *
 * The first ProcessCameraProvider.getInstance enumerates every camera on the
 * device and queries each one's characteristics, which Android documents as a
 * non-trivial cost per camera. The front camera is not used: it is too low
 * resolution for an identification photograph, so the camera screen has no
 * flip control. Hiding it shortens that enumeration.
 *
 * The configuration is process-wide, so the VisionCamera capture backend sees
 * the same limit. Binding a hidden camera throws IllegalArgumentException.
 *
 * configureInstance only works before the first getInstance, which is why it
 * runs from Application.onCreate rather than from the module or the view.
 */
private class CameraXConfigListener : ApplicationLifecycleListener {
  @OptIn(ExperimentalCameraProviderConfiguration::class)
  override fun onCreate(application: Application) {
    try {
      ProcessCameraProvider.configureInstance(
        CameraXConfig.Builder.fromConfig(Camera2Config.defaultConfig())
          .setAvailableCamerasLimiter(CameraSelector.DEFAULT_BACK_CAMERA)
          .build()
      )
    } catch (error: IllegalStateException) {
      // Something configured or started CameraX first. The camera still works,
      // with every camera enumerated, so this is logged rather than raised.
      Log.w(TAG, "CameraX was already configured; camera limit not applied", error)
    }
  }

  private companion object {
    const val TAG = "NativeIdentificationCamera"
  }
}
