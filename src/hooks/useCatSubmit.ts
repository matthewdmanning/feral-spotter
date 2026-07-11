/**
 * hooks/useCatSubmit.ts
 * Handles save, done (submit), and reset actions for the cat observation screen.
 * Owns all store mutations, API calls, cache updates, analytics events, and
 * navigation — none of this lives in the component.
 */

import { usePhotoStore, useSubmissionStore, useUIStore } from "@/src/hooks";
import type { CatFormValues } from "@/src/hooks/useCatForm";
import type { ObservedCat } from "@/src/hooks/useSubmissionStore";
import {
  EVENTS,
  fireAnalyticsEvent,
  registerCapture,
} from "@/src/lib/analytics/analytics";
import {
  deleteSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from "@/src/lib/cache/submissionCache";
import type { SubmissionApiPayload } from "@/src/types";
import { submitObservation } from "@/src/utils/api";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { usePostHog } from "posthog-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCatSubmitParams {
  form: CatFormValues;
  existingCat?: ObservedCat;
  annotationEnabled: boolean;
}

export interface CatSubmitResult {
  handleSave: () => void;
  handleDone: () => void;
  handleReset: () => void;
  isSubmitting: boolean;
  saveLabel: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCatSubmit({
  form,
  existingCat,
  annotationEnabled,
}: UseCatSubmitParams): CatSubmitResult {
  const cats = useSubmissionStore((s) => s.cats);
  const addCat = useSubmissionStore((s) => s.addCat);
  const updateCat = useSubmissionStore((s) => s.updateCat);
  const submission = useSubmissionStore((s) => s.submission);
  const addToHistory = useSubmissionStore((s) => s.addToHistory);
  const clearDraft = useSubmissionStore((s) => s.clearDraft);

  const photos = usePhotoStore((s) => s.photos);
  const clearPhotos = usePhotoStore((s) => s.clearPhotos);

  const showError = useUIStore((s) => s.showError);
  const setSubmitting = useUIStore((s) => s.setSubmitting);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register PostHog for IS_PRERELEASE analytics
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog?.capture) registerCapture(posthog.capture.bind(posthog));
  }, [posthog]);

  // ── Build ObservedCat from current form values ─────────────────────────────

  const buildCat = useCallback(
    (localId: string): ObservedCat => ({
      local_id: localId,
      age: form.age,
      ear_tipped: form.earTipped,
      health: form.health,
      owned_domesticated: form.owned,
      pattern: form.pattern,
      hair_length: form.hairLength,
      color: form.color,
      sex: form.sex,
      photo_local_ids: form.photoIds,
      photos_reviewed: existingCat?.photos_reviewed ?? false,
    }),
    [form, existingCat],
  );

  // ── Save → store + navigate ────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const localId = existingCat?.local_id ?? randomUUID();
    const cat = buildCat(localId);

    if (existingCat) updateCat(localId, cat);
    else addCat(cat);

    if (annotationEnabled && form.photoIds.length > 0) {
      router.replace({
        pathname: "/submission/annotate",
        params: { cat_id: localId },
      });
    } else {
      router.back();
    }
  }, [
    buildCat,
    existingCat,
    addCat,
    updateCat,
    annotationEnabled,
    form.photoIds.length,
  ]);

  // ── Done → confirm → API submit ───────────────────────────────────────────

  const handleDone = useCallback(() => {
    const localId = existingCat?.local_id ?? randomUUID();
    const cat = buildCat(localId);

    if (existingCat) updateCat(localId, cat);
    else addCat(cat);

    const allCats = cats.filter((c) => c.local_id !== localId).concat(cat);
    const catCount = allCats.length;
    const photoCount = photos.length;

    Alert.alert(
      "Submit Submission",
      `Submit ${catCount} cat${catCount !== 1 ? "s" : ""} and ${photoCount} photo${photoCount !== 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          style: "default",
          onPress: async () => {
            setIsSubmitting(true);
            setSubmitting(true);

            const cId = await getCurrentCacheId();
            if (cId) {
              await updateSubmissionCache(cId, {
                status: "Sending",
                cats: allCats,
                photo_links: photos.map((p) => p.uri),
              });
              const snap = await getSubmissionCache(cId);
              if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SENDING, snap);
            }

            try {
              const uploadedPhotos = photos.filter((p) => p.uploaded);
              const payload: SubmissionApiPayload = {
                submission,
                cats: allCats,
                photo_paths: uploadedPhotos.map((p) => p.cloud_storage_path!),
              };
              const response = await submitObservation(payload);

              if (response.status === "success") {
                if (cId) {
                  await updateSubmissionCache(cId, { status: "Submitted" });
                  const snap = await getSubmissionCache(cId);
                  if (snap)
                    fireAnalyticsEvent(EVENTS.SUBMISSION_SUBMITTED, snap);
                }
                addToHistory({
                  id: response.id,
                  ...submission,
                  cats: allCats,
                  photo_urls: uploadedPhotos.map((p) => p.cloud_storage_url!),
                  created_at: new Date(),
                  submitted_at: new Date(),
                  status: "submitted",
                });
                clearDraft();
                clearPhotos();
                router.replace("/");
              } else {
                throw new Error(response.message ?? "Submission failed");
              }
            } catch (err) {
              if (cId) {
                await updateSubmissionCache(cId, { status: "Failed" });
                const snap = await getSubmissionCache(cId);
                if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_FAILED, snap);
              }
              showError(
                "Submission Failed",
                err instanceof Error ? err.message : "Please try again",
              );
            } finally {
              setIsSubmitting(false);
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [
    buildCat,
    existingCat,
    addCat,
    updateCat,
    cats,
    photos,
    submission,
    addToHistory,
    clearDraft,
    clearPhotos,
    showError,
    setSubmitting,
  ]);

  // ── Reset → confirm → clear all ──────────────────────────────────────────

  const handleReset = useCallback(() => {
    Alert.alert(
      "Reset Submission",
      "This will permanently clear all cats, photos and submission data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const cId = await getCurrentCacheId();
            if (cId) await deleteSubmissionCache(cId);
            clearDraft();
            clearPhotos();
            router.replace("/");
          },
        },
      ],
    );
  }, [clearDraft, clearPhotos]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const saveLabel =
    annotationEnabled && form.photoIds.length > 0
      ? "Save & Review Photos"
      : "Save Observation";

  return { handleSave, handleDone, handleReset, isSubmitting, saveLabel };
}
