/**
 * hooks/useCameraAccess.ts
 * Camera OS-permission status via react-native-permissions, re-checked on app foreground
 * (covers permission grants/revocations made in system Settings mid-session).
 */
import { PERMISSION_MAP } from "@/src/lib/permissions";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { check, openSettings, request, RESULTS } from "react-native-permissions";

export interface CameraAccessResult {
  hasPermission: boolean;
  requestPermission: () => Promise<void>;
  openSettings: () => Promise<void>;
}

export function useCameraAccess(): CameraAccessResult {
  const [hasPermission, setHasPermission] = useState(false);

  const refresh = useCallback(async () => {
    const status = await check(PERMISSION_MAP.camera);
    setHasPermission(status === RESULTS.GRANTED || status === RESULTS.LIMITED);
  }, []);

  useEffect(() => {
    // Async permission check on mount — setState happens after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    const status = await request(PERMISSION_MAP.camera);
    setHasPermission(status === RESULTS.GRANTED || status === RESULTS.LIMITED);
  }, []);

  return { hasPermission, requestPermission, openSettings };
}
