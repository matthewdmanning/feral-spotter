import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import type { ColumnButton } from '@/src/components/atoms/AppButton'
import { getAllSubmissionCaches } from '@/src/lib/cache/submissionCache'
import HomeScreen from '../index'

/**
 * Model of every button on HomeScreen (src/screens/home/index.tsx) and what
 * pressing it does — complements HomeScreen.gate.model.test.tsx (auth/consent
 * redirect) and HomeScreen.photoSourceGate.model.test.tsx (camera/library
 * disabled state), neither of which asserts navigation destinations or the
 * bottom column's visibility gate. Auth/consent held ready+granted and photo
 * source held empty throughout — both orthogonal, already covered elsewhere.
 *
 * The Resume/New column's visibility is decided once, from
 * `getAllSubmissionCaches()` resolving inside a mount-only effect (empty dep
 * array) — not a live transition a rerender can drive, unlike the photo-source
 * gate. Modeled as two separate mount scenarios (MOUNT_NO_DRAFT /
 * MOUNT_IN_PROGRESS) rather than a mid-session transition, since that's what
 * the real component actually does.
 */
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  // spacing/radius/typography are real numbers (matching
  // src/config/unistyles.ts) so screens that do arithmetic on theme tokens
  // (e.g. HomeScreen's entrypoint-circle sizing) don't hit
  // "Cannot convert object to primitive value" from the generic anyProp stub.
  const knownTokens = {
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    radius: { sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, full: 9999 },
    typography: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 },
  }
  const theme = new Proxy(knownTokens, {
    get: (t, k: string) => (k in t ? t[k as keyof typeof t] : anyProp()),
  })
  const withVariants = (obj: object) =>
    Object.assign(obj, { useVariants: jest.fn() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) =>
        withVariants(typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ isReady: true, isAuthenticated: true }),
}))
jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: () => true,
}))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn(),
}))
jest.mock('@/src/hooks/usePhotoStore', () => ({
  usePhotoStore: (sel: (s: { source: null }) => unknown) =>
    sel({ source: null }),
}))
const mockPickFromLibrary = jest.fn()
jest.mock('@/src/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: mockPickFromLibrary }),
}))
jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  ImagePlus: () => null,
}))

let capturedButtons: ColumnButton[] = []
// null (not false) until the mount effect resolves, so idleEntry's
// `toBe(false)` assertion actually proves the effect ran rather than
// matching the untouched default.
let capturedVisible: boolean | null = null
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: (props: {
    buttons: ColumnButton[]
    visible: boolean
  }) => {
    capturedButtons = props.buttons
    capturedVisible = props.visible
    return null
  },
}))

const buttonsMachine = createMachine({
  id: 'homeEntrypointActions',
  initial: 'unmounted',
  states: {
    unmounted: {
      on: {
        MOUNT_NO_DRAFT: 'idleEntry',
        MOUNT_IN_PROGRESS: 'resumeEntry',
        MOUNT_STALE: 'idleEntry',
      },
    },
    idleEntry: {
      on: {
        PRESS_CAMERA: 'idleEntry',
        PRESS_LIBRARY: 'idleEntry',
      },
    },
    resumeEntry: {
      on: {
        PRESS_CAMERA: 'resumeEntry',
        PRESS_LIBRARY: 'resumeEntry',
        PRESS_RESUME: 'resumeEntry',
        PRESS_NEW: 'resumeEntry',
      },
    },
  },
})

describe('HomeScreen entrypoint buttons — model-based test', () => {
  let getByLabelText: ReturnType<typeof render>['getByLabelText']

  beforeEach(() => {
    jest.clearAllMocks()
    capturedButtons = []
    capturedVisible = null
  })

  const model = createTestModel(buttonsMachine)

  const mount = async (caches: { status: string; updated_at?: string }[]) => {
    jest.mocked(getAllSubmissionCaches).mockResolvedValue(
      caches.map((c) => ({
        updated_at: new Date().toISOString(),
        ...c,
      })) as never,
    )
    const result = render(<HomeScreen />)
    getByLabelText = result.getByLabelText
    await waitFor(() => expect(getAllSubmissionCaches).toHaveBeenCalled())
  }

  const testParams = {
    states: {
      unmounted: () => {
        expect(router.navigate).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
      },
      idleEntry: async () => {
        await waitFor(() => expect(capturedVisible).toBe(false))
      },
      resumeEntry: async () => {
        await waitFor(() => expect(capturedVisible).toBe(true))
      },
    },
    events: {
      MOUNT_NO_DRAFT: async () => {
        await mount([])
      },
      MOUNT_IN_PROGRESS: async () => {
        await mount([{ status: 'In Progress' }])
      },
      MOUNT_STALE: async () => {
        await mount([
          {
            status: 'In Progress',
            updated_at: new Date(
              Date.now() - 25 * 60 * 60 * 1000,
            ).toISOString(),
          },
        ])
      },
      PRESS_CAMERA: () => {
        fireEvent.press(getByLabelText('Take Photos'))
      },
      PRESS_LIBRARY: () => {
        fireEvent.press(getByLabelText('Upload Photos'))
      },
      PRESS_RESUME: () => {
        capturedButtons.find((b) => b.key === 'continue')?.onPress()
      },
      PRESS_NEW: () => {
        capturedButtons.find((b) => b.key === 'new')?.onPress()
      },
    },
  }

  // UX journeys, not exhaustive coverage: each is a sequence of real user
  // actions, asserting what pressing each button actually does.
  const journeys = [
    {
      name: 'no in-progress draft: Resume/New column stays hidden',
      events: [{ type: 'MOUNT_NO_DRAFT' }],
    },
    {
      name: 'in-progress draft: Resume/New column becomes visible',
      events: [{ type: 'MOUNT_IN_PROGRESS' }],
    },
    {
      name: 'stale in-progress draft: Resume/New column stays hidden',
      events: [{ type: 'MOUNT_STALE' }],
    },
    {
      name: 'Take Photos navigates to the camera',
      events: [{ type: 'MOUNT_NO_DRAFT' }, { type: 'PRESS_CAMERA' }],
    },
    {
      name: 'Upload Photos invokes the library picker',
      events: [{ type: 'MOUNT_NO_DRAFT' }, { type: 'PRESS_LIBRARY' }],
    },
    {
      name: 'Continue Observation returns to Cat List',
      events: [{ type: 'MOUNT_IN_PROGRESS' }, { type: 'PRESS_RESUME' }],
    },
    {
      name: 'New Sighting also goes to Submission Details',
      events: [{ type: 'MOUNT_IN_PROGRESS' }, { type: 'PRESS_NEW' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)

      if (events.some((e) => e.type === 'PRESS_CAMERA')) {
        expect(router.navigate).toHaveBeenCalledWith('/camera')
      }
      if (events.some((e) => e.type === 'PRESS_LIBRARY')) {
        expect(mockPickFromLibrary).toHaveBeenCalledTimes(1)
      }
      if (
        events.some((e) => e.type === 'PRESS_RESUME' || e.type === 'PRESS_NEW')
      ) {
        expect(router.push).toHaveBeenCalledWith('/submission/create')
      }
    })
  })
})
