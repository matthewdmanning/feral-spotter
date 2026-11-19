/**
 * workflows/photo-entry/hooks/usePhotoEntrypoints.ts
 * The two photo entrypoints and the single-source rule (ADR 0002
 * amendment): once the draft's pool holds photos from one source, the
 * other source is disabled until the draft is sent or reset, and "add more
 * photos" reopens the source that started it. Home and Submission Details
 * both render from this, so the rule lives once.
 */

import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { useLibraryPhotoPicker } from '@/src/features/library-picker/hooks/useLibraryPhotoPicker'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { router } from 'expo-router'
import { useCallback, useMemo } from 'react'

export interface PhotoEntrypoint {
  disabled: boolean
  open: () => void
}

export interface PhotoEntrypoints {
  camera: PhotoEntrypoint
  library: PhotoEntrypoint
  /** Reopens the source that started this draft. */
  addMore: { label: string; open: () => void }
}

export function usePhotoEntrypoints(): PhotoEntrypoints {
  const source = usePhotoStore((s) => s.source)
  const draftReady = useDraftStartupStore((s) => s.phase === 'ready')
  const { pickFromLibrary } = useLibraryPhotoPicker()
  const openCamera = useCallback(() => router.navigate('/camera'), [])
  const openLibrary = useCallback(() => {
    void pickFromLibrary()
  }, [pickFromLibrary])

  return useMemo(
    () => ({
      camera: {
        disabled: draftReady && source === 'library',
        open: openCamera,
      },
      library: {
        disabled: !draftReady || source === 'camera',
        open: openLibrary,
      },
      addMore:
        source === 'camera'
          ? { label: 'Take More Photos', open: openCamera }
          : { label: 'Select More Photos', open: openLibrary },
    }),
    [draftReady, source, openCamera, openLibrary],
  )
}
