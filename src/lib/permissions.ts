/**
 * lib/permissions.ts
 * Live OS permission queries + requests for the three consent primers.
 *
 * useConsentStore records primer decision *history* for gating/audit, but
 * per its own docstring the OS permission must always be re-checked at
 * point of use — Settings can change independently of that history. This
 * module is that live check; callers write the outcome back via
 * setPrimerStatus themselves.
 */

import type { PrimerKey } from "@/src/config/onboardingCopy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { VisionCamera } from "react-native-vision-camera";

/**
 * granted: proceed. ask: OS will still show its native prompt — show
 * PermissionPrimer. blocked: user must go to Settings — show PermissionDenied.
 */
export type PermissionState = "granted" | "ask" | "blocked";

function fromExpoResponse(response: {
  granted: boolean;
  canAskAgain: boolean;
}): PermissionState {
  if (response.granted) return "granted";
  return response.canAskAgain ? "ask" : "blocked";
}

export async function getPermissionState(
  key: PrimerKey,
): Promise<PermissionState> {
  switch (key) {
    case "location": {
      const response = await Location.getForegroundPermissionsAsync();
      return fromExpoResponse(response);
    }
    case "camera": {
      const status = VisionCamera.cameraPermissionStatus;
      if (status === "authorized") return "granted";
      return status === "not-determined" ? "ask" : "blocked";
    }
    case "photo_library": {
      const response = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (response.granted || response.accessPrivileges === "limited")
        return "granted";
      return response.canAskAgain ? "ask" : "blocked";
    }
    default:
      return "blocked";
  }
}

/** Fires the OS permission prompt. Resolves true if granted (or limited, for photo_library). */
export async function requestPermission(key: PrimerKey): Promise<boolean> {
  switch (key) {
    case "location": {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === "granted";
    }
    case "camera": {
      return await VisionCamera.requestCameraPermission();
    }
    case "photo_library": {
      const { status, accessPrivileges } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted" || accessPrivileges === "limited";
    }
    default:
      return false;
  }
}
