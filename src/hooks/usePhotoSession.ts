/**
 * hooks/usePhotoSession.ts
 * Manages the photos screen session:
 *   - Camera + library capture → addSessionPhoto
 *   - Checked state (which session photos are included in submission)
 *   - handleDone: syncs checked state to photoStore, navigates back
 */

import { useState, useCallback, useEffect } from 'react'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { nanoid } from 'nanoid'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import { usePhotoStore, useSubmissionStore, useUIStore } from '@/src/hooks'
import type { SubmissionPhoto } from '@/src/types'

export interface PhotoSessionResult {
  sessionPhotos:   SubmissionPhoto[]
  checked:         Record<string, boolean>
  checkedCount:    number
  capturePhoto:    () => Promise<void>
  pickFromLibrary: () => Promise<void>
  handleDone:      () => void
  toggleChecked:   (id: string) => void
}

export function usePhotoSession(): PhotoSessionResult {
  const setCurrentStep  = useSubmissionStore((s) => s.setCurrentStep)
  const sessionPhotos   = useUIStore((s) => s.sessionPhotos)
  const addSessionPhoto = useUIStore((s) => s.addSessionPhoto)
  const showError       = useUIStore((s) => s.showError)
  const submissionPhotos = usePhotoStore((s) => s.photos)
  const addPhotos        = usePhotoStore((s) => s.addPhotos)
  const removePhoto      = usePhotoStore((s) => s.removePhoto)

  const submissionIds = new Set(submissionPhotos.map((p) => p.local_id))

  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(
      sessionPhotos.map((p) => [p.local_id, submissionIds.has(p.local_id)]),
    ),
  )

  // Auto-check newly added session photos
  useEffect(() => {
    setChecked((prev) => {
      const next = { ...prev }
      let changed = false
      for (const p of sessionPhotos) {
        if (!(p.local_id in next)) {
          next[p.local_id] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [sessionPhotos])

  useEffect(() => { setCurrentStep('photos') }, [])

  const toggleChecked = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleDone = useCallback(() => {
    sessionPhotos.forEach((photo) => {
      const isChecked    = checked[photo.local_id] ?? false
      const inSubmission = submissionIds.has(photo.local_id)
      if      (isChecked && !inSubmission) addPhotos([photo])
      else if (!isChecked && inSubmission) removePhoto(photo.local_id)
    })
    router.back()
  }, [sessionPhotos, checked, submissionIds, addPhotos, removePhoto])

  useBackHandler(useCallback(() => { handleDone(); return true }, [handleDone]))

  const buildPhoto = (asset: ImagePicker.ImagePickerAsset): SubmissionPhoto => ({
    local_id:        nanoid(),
    uri:             asset.uri,
    uploaded:        false,
    upload_progress: 0,
    width:           asset.width,
    height:          asset.height,
    exif: asset.exif ? {
      latitude:     asset.exif.GPSLatitude,
      longitude:    asset.exif.GPSLongitude,
      timestamp:    asset.exif.DateTime,
      camera_make:  asset.exif.Make,
      camera_model: asset.exif.Model,
    } : undefined,
  })

  const capturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { showError('Permission Denied', 'Camera access is required'); return }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 1, exif: true,
    })
    if (!result.canceled && result.assets.length > 0) {
      addSessionPhoto(buildPhoto(result.assets[0]))
    }
  }, [addSessionPhoto, showError])

  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, quality: 1, exif: true,
    })
    if (!result.canceled) {
      result.assets.forEach((asset) => addSessionPhoto(buildPhoto(asset)))
    }
  }, [addSessionPhoto])

  const checkedCount = Object.values(checked).filter(Boolean).length

  return {
    sessionPhotos, checked, checkedCount,
    capturePhoto, pickFromLibrary, handleDone, toggleChecked,
  }
}
