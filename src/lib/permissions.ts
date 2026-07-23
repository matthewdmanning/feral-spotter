/**
 * lib/permissions.ts
 * Maps app-level permission names to platform-specific react-native-permissions constants.
 */
import { Platform } from "react-native";
import { PERMISSIONS, type Permission } from "react-native-permissions";

export type AppPermission = "camera" | "mediaLibrary" | "location";

export const PERMISSION_MAP: Record<AppPermission, Permission> = Platform.select({
  ios: {
    camera: PERMISSIONS.IOS.CAMERA,
    mediaLibrary: PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY,
    location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  },
  android: {
    camera: PERMISSIONS.ANDROID.CAMERA,
    mediaLibrary: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
    location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  },
  default: {
    camera: PERMISSIONS.IOS.CAMERA,
    mediaLibrary: PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY,
    location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  },
});
