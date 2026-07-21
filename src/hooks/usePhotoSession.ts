/**
 * hooks/usePhotoSession.ts
 * Manages the photos screen session:
 *   - Camera + library capture → addSessionPhoto
 *   - Checked state (which session photos are included in submission)
 *   - handleDone: syncs checked state to photoStore, navigates back
 */

import { usePhotoStore, useSubmissionStore, useUIStore } from "@/src/hooks";
import { useBackHandler } from "@/src/hooks/useBackHandler";
import { useConsentStore } from "@/src/hooks/useConsentStore";
import {
  getPermissionState,
  requestPermission,
  type PermissionState,
} from "@/src/lib/permissions";
import type { SubmissionPhoto } from "@/src/types";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface PhotoSessionResult {
  sessionPhotos: SubmissionPhoto[];
  checked: Record<string, boolean>;
  checkedCount: number;
  capturePhoto: () => Promise<void>;
  pickFromLibrary: () => Promise<void>;
  handleDone: () => void;
  toggleChecked: (id: string) => void;
  /** Contextual re-prime, shown when photo_library permission isn't granted. */
  libraryGate: {
    visible: boolean;
    blocked: boolean;
    loading: boolean;
    onAffirm: () => void;
    onDefer: () => void;
    onDismiss: () => void;
  };
}

export function usePhotoSession(): PhotoSessionResult {
  const setCurrentStep = useSubmissionStore((s) => s.setCurrentStep);
  const sessionPhotos = useUIStore((s) => s.sessionPhotos);
  const addSessionPhoto = useUIStore((s) => s.addSessionPhoto);
  const showError = useUIStore((s) => s.showError);
  const submissionPhotos = usePhotoStore((s) => s.photos);
  const addPhotos = usePhotoStore((s) => s.addPhotos);
  const removePhoto = usePhotoStore((s) => s.removePhoto);
  const setPrimerStatus = useConsentStore((s) => s.setPrimerStatus);

  const [libraryGateState, setLibraryGateState] =
    useState<PermissionState | null>(null);
  const [libraryGateLoading, setLibraryGateLoading] = useState(false);

  const submissionIds = useMemo(
    () => new Set(submissionPhotos.map((p) => p.local_id)),
    [submissionPhotos],
  );

  // Track only explicitly-unchecked IDs; new photos are checked by default.
  const [unchecked, setUnchecked] = useState<Set<string>>(
    () =>
      new Set(
        sessionPhotos
          .filter((p) => !submissionIds.has(p.local_id))
          .map((p) => p.local_id),
      ),
  );

  const checked: Record<string, boolean> = Object.fromEntries(
    sessionPhotos.map((p) => [p.local_id, !unchecked.has(p.local_id)]),
  );

  useEffect(() => {
    setCurrentStep("photos");
  }, [setCurrentStep]);

  const toggleChecked = useCallback((id: string) => {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDone = useCallback(() => {
    sessionPhotos.forEach((photo) => {
      const isChecked = checked[photo.local_id] ?? false;
      const inSubmission = submissionIds.has(photo.local_id);
      if (isChecked && !inSubmission) addPhotos([photo]);
      else if (!isChecked && inSubmission) removePhoto(photo.local_id);
    });
    router.back();
  }, [sessionPhotos, checked, submissionIds, addPhotos, removePhoto]);

  useBackHandler(
    useCallback(() => {
      handleDone();
      return true;
    }, [handleDone]),
  );

  const buildPhoto = (
    asset: ImagePicker.ImagePickerAsset,
  ): SubmissionPhoto => ({
    local_id: randomUUID(),
    uri: asset.uri,
    uploaded: false,
    upload_progress: 0,
    width: asset.width,
    height: asset.height,
    exif: asset.exif
      ? {
          latitude: asset.exif.GPSLatitude,
          longitude: asset.exif.GPSLongitude,
          timestamp: asset.exif.DateTime,
          camera_make: asset.exif.Make,
          camera_model: asset.exif.Model,
        }
      : undefined,
  });

  const capturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Denied", "Camera access is required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      addSessionPhoto(buildPhoto(result.assets[0]));
    }
  }, [addSessionPhoto, showError]);

  const launchLibraryPicker = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    });
    if (!result.canceled) {
      result.assets.forEach((asset) => addSessionPhoto(buildPhoto(asset)));
    }
  }, [addSessionPhoto]);

  const pickFromLibrary = useCallback(async () => {
    const state = await getPermissionState("photo_library");
    if (state === "granted") {
      await launchLibraryPicker();
      return;
    }
    setLibraryGateState(state);
  }, [launchLibraryPicker]);

  const handleLibraryAffirm = useCallback(() => {
    void (async () => {
      setLibraryGateLoading(true);
      try {
        const granted = await requestPermission("photo_library");
        setPrimerStatus("photo_library", granted ? "granted" : "declined");
        setLibraryGateState(null);
        if (granted) await launchLibraryPicker();
      } finally {
        setLibraryGateLoading(false);
      }
    })();
  }, [launchLibraryPicker, setPrimerStatus]);

  const handleLibraryDefer = useCallback(() => {
    setPrimerStatus("photo_library", "deferred");
    setLibraryGateState(null);
  }, [setPrimerStatus]);

  const handleLibraryDismiss = useCallback(() => setLibraryGateState(null), []);

  const checkedCount = sessionPhotos.filter(
    (p) => !unchecked.has(p.local_id),
  ).length;

  return {
    sessionPhotos,
    checked,
    checkedCount,
    capturePhoto,
    pickFromLibrary,
    handleDone,
    toggleChecked,
    libraryGate: {
      visible: libraryGateState !== null,
      blocked: libraryGateState === "blocked",
      loading: libraryGateLoading,
      onAffirm: handleLibraryAffirm,
      onDefer: handleLibraryDefer,
      onDismiss: handleLibraryDismiss,
    },
  };
}
