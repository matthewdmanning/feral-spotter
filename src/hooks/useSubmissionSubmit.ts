/**
 * hooks/useSubmissionSubmit.ts
 * Final "Done" and "Reset" actions for the submission, both called from
 * Submission Details (src/screens/submission/create/index.tsx). handleDone
 * moved here from the Cat Observations screen (#130); handleReset moved
 * here from useCatSubmit (#153) — it wipes the whole submission, so it
 * belongs on the whole-submission screen, not a single cat's form. Neither
 * has a per-cat form to fold in first: every cat is already saved in the
 * store by the time the user reaches Submission Details. handleDone does
 * not itself validate — the warning icon is informational, not a submit
 * gate.
 */

import { usePhotoStore, useSubmissionStore, useUIStore } from '@/src/hooks'
import { EVENTS, fireAnalyticsEvent } from '@/src/lib/analytics/analytics'
import {
  deleteSubmissionCache,
  getCurrentCacheId,
  getSubmissionCache,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import { stopLocationCapture } from '@/src/lib/location'
import type { SubmissionApiPayload, SubmissionPhoto } from '@/src/types'
import { submitObservation } from '@/src/utils/api'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

export interface SubmissionSubmitResult {
  handleDone: () => void
  handleReset: () => void
  isSubmitting: boolean
}

export function useSubmissionSubmit(): SubmissionSubmitResult {
  const cats = useSubmissionStore((s) => s.cats)
  const submission = useSubmissionStore((s) => s.submission)
  const addToHistory = useSubmissionStore((s) => s.addToHistory)
  const clearDraft = useSubmissionStore((s) => s.clearDraft)

  const photos = usePhotoStore((s) => s.photos)
  const clearPhotos = usePhotoStore((s) => s.clearPhotos)

  const showError = useUIStore((s) => s.showError)
  const setSubmitting = useUIStore((s) => s.setSubmitting)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDone = useCallback(() => {
    const catCount = cats.length
    const photoCount = photos.length

    Alert.alert(
      'Submit Submission',
      `Submit ${catCount} cat${catCount !== 1 ? 's' : ''} and ${photoCount} photo${photoCount !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true)
            setSubmitting(true)

            const cId = await getCurrentCacheId()
            if (cId) {
              // metadata is replaced wholesale on update (no deep merge), so
              // resend the full current snapshot here — not just the fields
              // this submit touches — or fields set after cache creation
              // (e.g. manual_time, filled in after the initial snapshot on
              // an EXIF-less Library pick) get silently dropped.
              await updateSubmissionCache(cId, {
                status: 'Sending',
                cats,
                photo_links: photos.map((p) => p.uri),
                metadata: {
                  location_method: submission.location_type,
                  time_method: submission.time_type,
                  address: submission.address,
                  manual_time: submission.manual_time,
                  captured_at: submission.captured_at,
                },
              })
              const snap = await getSubmissionCache(cId)
              if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_SENDING, snap)
            }

            try {
              const uploadedPhotos = photos.filter(
                (
                  p,
                ): p is SubmissionPhoto & {
                  cloud_storage_path: string
                  cloud_storage_url: string
                } =>
                  p.uploaded &&
                  p.cloud_storage_path != null &&
                  p.cloud_storage_url != null,
              )
              // One Submission location, shared by every photo (ADR 0002).
              const { latitude, longitude } = submission
              const photoLocations =
                latitude != null && longitude != null
                  ? uploadedPhotos.map((p) => ({
                      path: p.cloud_storage_path,
                      latitude,
                      longitude,
                    }))
                  : []

              const payload: SubmissionApiPayload = {
                submission,
                cats,
                photo_paths: uploadedPhotos.map((p) => p.cloud_storage_path),
                ...(photoLocations.length > 0 && {
                  photo_locations: photoLocations,
                }),
              }
              const response = await submitObservation(payload)

              if (response.status === 'success') {
                if (cId) {
                  await updateSubmissionCache(cId, { status: 'Submitted' })
                  const snap = await getSubmissionCache(cId)
                  if (snap)
                    fireAnalyticsEvent(EVENTS.SUBMISSION_SUBMITTED, snap)
                }
                addToHistory({
                  id: response.id,
                  ...submission,
                  cats,
                  photo_urls: uploadedPhotos.map((p) => p.cloud_storage_url),
                  created_at: new Date(),
                  submitted_at: new Date(),
                  status: 'submitted',
                })
                clearDraft()
                clearPhotos()
                stopLocationCapture()
                router.replace('/')
              } else {
                throw new Error(response.message ?? 'Submission failed')
              }
            } catch (err) {
              if (cId) {
                await updateSubmissionCache(cId, { status: 'Failed' })
                const snap = await getSubmissionCache(cId)
                if (snap) fireAnalyticsEvent(EVENTS.SUBMISSION_FAILED, snap)
              }
              showError(
                'Submission Failed',
                err instanceof Error ? err.message : 'Please try again',
              )
            } finally {
              setIsSubmitting(false)
              setSubmitting(false)
            }
          },
        },
      ],
    )
  }, [
    cats,
    photos,
    submission,
    addToHistory,
    clearDraft,
    clearPhotos,
    showError,
    setSubmitting,
  ])

  // ── Reset → confirm → clear all (#153) ─────────────────────────────────────

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Submission',
      'This will permanently clear all cats, photos and submission data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const cId = await getCurrentCacheId()
            if (cId) await deleteSubmissionCache(cId)
            clearDraft()
            clearPhotos()
            stopLocationCapture()
            router.replace('/')
          },
        },
      ],
    )
  }, [clearDraft, clearPhotos])

  return { handleDone, handleReset, isSubmitting }
}
