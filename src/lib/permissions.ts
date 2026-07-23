/**
 * lib/permissions.ts
 * Maps app-level permission names to platform-specific react-native-permissions constants.
 */
import { Platform } from "react-native";
import { PERMISSIONS, type Permission } from "react-native-permissions";

export type AppPermission = "camera" | "mediaLibrary";

export const PERMISSION_MAP: Record<AppPermission, Permission> = Platform.select({
  ios: {
    camera: PERMISSIONS.IOS.CAMERA,
    mediaLibrary: PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY,
  },
  android: {
    camera: PERMISSIONS.ANDROID.CAMERA,
    mediaLibrary: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
  },
  default: {
    camera: PERMISSIONS.IOS.CAMERA,
    mediaLibrary: PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY,
  },
});
