/**
 * hooks/useSubmissionSubmit.ts
 * Final "Done" action for the submission, called from Submission Details
 * (src/screens/submission/create/index.tsx) — moved here from the Cat
 * Observations screen (#130). Unlike useCatSubmit's handleSave, this has no
 * per-cat form to fold in first: every cat is already saved in the store by
 * the time the user reaches Submission Details, so this just submits the
 * cats/photos/location as they stand. It does not itself validate — the
 * warning icon is informational, not a submit gate.
 */

import { usePhotoStore, useSubmissionStore, useUIStore } from '@/src/hooks'
import { EVENTS, fireAnalyticsEvent } from '@/src/lib/analytics/analytics'
import {
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
              await updateSubmissionCache(cId, {
                status: 'Sending',
                cats,
                photo_links: photos.map((p) => p.uri),
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

  return { handleDone, isSubmitting }
}
