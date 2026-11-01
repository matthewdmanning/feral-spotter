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
 * Compare the complete persisted state with the real stores' initial state,
 * including Submission metadata and draft identifiers that have no cat/photo
 * marker. Seed every draft-owned store before testing either teardown verb.
 */

const mockStopLocationCapture = jest.fn()
jest.mock('@/src/core/location/liveFix', () => ({
  stopLocationCapture: () => mockStopLocationCapture(),
}))

const mockDeleteSubmissionUploads = jest.fn()
jest.mock('@/src/lib/upload/firebaseUpload', () => ({
  deleteSubmissionUploads: (uid: string, submissionId: string) =>
    mockDeleteSubmissionUploads(uid, submissionId),
}))

jest.mock('@/src/features/auth/lib', () => ({
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
const draftStores = [
  useSubmissionStore,
  usePhotoStore,
  useBoundingBoxStore,
  useActiveCatFlowStore,
]

// JSON serialization matches persist: functions and undefined fields are omitted.
const initialPersistedState = Object.fromEntries(
  draftStores.map((store) => [
    store.persist.getOptions().name,
    JSON.parse(JSON.stringify(store.getInitialState())),
  ]),
)

const buildFullDraft = () => {
  useSubmissionStore.getState().setSubmission({
    location_type: 'pin',
    time_type: 'manual',
    address: 'Draft Map picker location',
    latitude: 34.6834,
    longitude: -82.8374,
    accuracy: 5,
    manual_time: '2026-08-01T10:00:00.000Z',
    captured_at: '2026-08-01T09:00:00.000Z',
  })
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
  for (const localId of [PHOTO_ID, 'photo-2']) {
    usePhotoStore.getState().addPhoto({
      local_id: localId,
      uri: `file://${localId}.jpg`,
      uploaded: false,
      upload_progress: 0,
      width: 100,
      height: 100,
    })
  }
  useBoundingBoxStore.getState().addBox(CAT_ID, PHOTO_ID, {
    lowerLeftX: 1,
    lowerLeftY: 1,
    upperRightX: 9,
    upperRightY: 9,
  })
  useBoundingBoxStore.getState().markAbsent(CAT_ID, 'photo-2')
  usePhotoStore.setState({ submissionId: 'draft-submission' })
  useActiveCatFlowStore.getState().setActiveCatId(CAT_ID)
}

/** Lets zustand's persist middleware finish its async writes. */
const flushPersist = () => new Promise((resolve) => setImmediate(resolve))

/** Read complete JSON payloads, including unexpected draft-owned keys. */
const readPersistedDraft = async () => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) => !NOT_DRAFT_OWNED.some((skip) => skip.test(key)),
  )
  const entries = await AsyncStorage.multiGet(keys)
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      value ? JSON.parse(value).state : null,
    ]),
  )
}

describe('draft teardown — survival invariant (#292)', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    useSubmissionStore.setState(useSubmissionStore.getInitialState(), true)
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    useBoundingBoxStore.setState(useBoundingBoxStore.getInitialState(), true)
    useActiveCatFlowStore.setState(
      useActiveCatFlowStore.getInitialState(),
      true,
    )
    await flushPersist()
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
      const persistedDraft = await readPersistedDraft()
      expect(Object.keys(persistedDraft).sort()).toEqual(
        Object.keys(initialPersistedState).sort(),
      )
      for (const [key, initialState] of Object.entries(initialPersistedState)) {
        expect(persistedDraft[key]).not.toEqual(initialState)
      }

      await teardown()
      await flushPersist()

      expect(await readPersistedDraft()).toEqual(initialPersistedState)
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
