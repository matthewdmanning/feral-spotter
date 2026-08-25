import AsyncStorage from '@react-native-async-storage/async-storage'
import { useActiveCatFlowStore } from '@/src/hooks/useActiveCatFlowStore'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { completeDraft, discardDraft } from '../draft'

/**
 * The survival invariant (#292): after either teardown verb, no draft-owned
 * AsyncStorage key still holds content.
 *
 * Deliberately asserted against *actual storage contents* via an exclusion
 * list rather than a hand-written list of the four store keys — a fifth
 * draft store added later must fail this test without anyone remembering to
 * update it. That regression has already happened twice (bounding-box-store
 * cleared by nobody; active-cat-flow-store missing from PERSISTED_STORE_KEYS).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

const mockStopLocationCapture = jest.fn()
jest.mock('@/src/lib/location', () => ({
  stopLocationCapture: () => mockStopLocationCapture(),
}))

const mockDeleteSubmissionUploads = jest.fn()
jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  deleteSubmissionUploads: (uid: string, submissionId: string) =>
    mockDeleteSubmissionUploads(uid, submissionId),
}))

jest.mock('@/src/lib/auth', () => ({
  authProvider: { getCurrentUser: () => ({ uid: 'uid-test' }) },
}))

/** Not draft-owned: history rows and their index/pointer, plus stores outside the boundary. */
const NOT_DRAFT_OWNED = [
  /^submission_cache/,
  /^settings-store$/,
  /^consent-store$/,
  /^ui-store$/,
]

const CAT_ID = 'cat-1'
const PHOTO_ID = 'photo-1'
/** Any of these surviving in a persisted store means draft data survived. */
const DRAFT_MARKERS = new RegExp(`${CAT_ID}|${PHOTO_ID}`)

const buildFullDraft = () => {
  useSubmissionStore.getState().addCat({
    local_id: CAT_ID,
    age: 'adult',
    ear_tipped: 'unsure',
    owned_domesticated: 'unsure',
    pattern: 'solid',
    hair_length: 'short',
    color: 'black',
    sex: 'unknown',
    health_label: 'unknown',
    photo_local_ids: [PHOTO_ID],
    photos_reviewed: true,
  })
  usePhotoStore.getState().addPhoto({
    local_id: PHOTO_ID,
    uri: `file://${PHOTO_ID}.jpg`,
    uploaded: false,
    upload_progress: 0,
    width: 100,
    height: 100,
  })
  useBoundingBoxStore.getState().addBox(CAT_ID, PHOTO_ID, {
    lowerLeftX: 1,
    lowerLeftY: 1,
    upperRightX: 9,
    upperRightY: 9,
  })
  useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
}

/** Lets zustand's persist middleware finish its async writes. */
const flushPersist = () => new Promise((resolve) => setImmediate(resolve))

/** Keys that currently hold something other than an empty/default payload. */
const draftOwnedKeysWithContent = async (): Promise<string[]> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) => !NOT_DRAFT_OWNED.some((skip) => skip.test(k)),
  )
  const entries = await AsyncStorage.multiGet(keys)
  return entries
    .filter(([, value]) => {
      if (!value) return false
      // zustand persists `{ state: {...}, version }` — a cleared store still
      // has a row, so "held content" means the draft data inside it survived.
      const { state } = JSON.parse(value) as { state: Record<string, unknown> }
      return DRAFT_MARKERS.test(JSON.stringify(state))
    })
    .map(([key]) => key)
}

describe('draft teardown — survival invariant (#292)', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  it.each([
    ['discardDraft', discardDraft],
    ['completeDraft', completeDraft],
  ])(
    '%s leaves no draft-owned key holding content',
    async (_name, teardown) => {
      buildFullDraft()
      await flushPersist()

      // Guards against a vacuous pass: the keys have to hold the draft before
      // teardown, or their absence afterwards proves nothing.
      expect(await draftOwnedKeysWithContent()).toEqual(
        expect.arrayContaining([
          'submission-store',
          'photo-store',
          'bounding-box-store',
          'active-cat-flow-store',
        ]),
      )

      await teardown()
      await flushPersist()

      expect(await draftOwnedKeysWithContent()).toEqual([])
      expect(mockStopLocationCapture).toHaveBeenCalled()
    },
  )

  // ── #293: "no metadata ⇒ no photo", client best-effort half ─────────────

  it("discardDraft asks Storage to delete the abandoned draft's uploads", async () => {
    buildFullDraft()
    // Set explicitly rather than relying on addPhoto's randomUUID mint —
    // the id's provenance isn't what's under test here, the fact that
    // discardDraft reads it and asks Storage to clean up is.
    usePhotoStore.setState({ submissionId: 'sub-test' })
    await flushPersist()

    await discardDraft()

    expect(mockDeleteSubmissionUploads).toHaveBeenCalledWith(
      'uid-test',
      'sub-test',
    )
  })

  it('completeDraft does NOT delete uploads — a submitted submission keeps its photos', async () => {
    buildFullDraft()
    usePhotoStore.setState({ submissionId: 'sub-test' })
    await flushPersist()

    await completeDraft()

    expect(mockDeleteSubmissionUploads).not.toHaveBeenCalled()
  })
})
