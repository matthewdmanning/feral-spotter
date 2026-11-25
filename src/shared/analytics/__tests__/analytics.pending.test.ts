import {
  EVENTS,
  MAX_PENDING_CAPTURES,
  captureEvent,
  captureException,
  clearPendingCaptures,
  registerCapture,
  registerCaptureException,
} from '@/src/shared/analytics/analytics'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'

/**
 * #197: consent flips, then navigation fires events before AnalyticsBridge
 * registers the SDK. Those calls must reach PostHog once it registers, and
 * must not if consent was revoked in between.
 */

const capture = jest.fn()
const captureError = jest.fn()

function allowAnalytics(allowed: boolean) {
  useConsentStore.setState({
    accepted: true,
    acceptedVersion: CONSENT_VERSION,
    analyticsAccepted: allowed,
  })
}

function register() {
  registerCapture(capture)
  registerCaptureException(captureError)
}

beforeEach(() => {
  registerCapture(null)
  registerCaptureException(null)
  clearPendingCaptures()
  allowAnalytics(true)
})

it('replays calls made before registration, in order', () => {
  const error = new Error('early')
  captureEvent(EVENTS.CAMERA_OPENED)
  captureException(error, { error_source: 'test' })
  captureEvent(EVENTS.PHOTO_CAPTURED, { n: 1 })

  register()

  expect(capture.mock.calls).toEqual([
    [EVENTS.CAMERA_OPENED, undefined],
    [EVENTS.PHOTO_CAPTURED, { n: 1 }],
  ])
  expect(captureError).toHaveBeenCalledWith(error, { error_source: 'test' })
})

it('drops pending calls when analytics is revoked before registration', () => {
  captureEvent(EVENTS.CAMERA_OPENED)
  allowAnalytics(false)

  register()
  allowAnalytics(true)
  registerCapture(capture)

  expect(capture).not.toHaveBeenCalled()
})

it('keeps only the newest calls past the cap', () => {
  for (let n = 0; n < MAX_PENDING_CAPTURES + 5; n++) {
    captureEvent(EVENTS.PHOTO_CAPTURED, { n })
  }

  register()

  expect(capture).toHaveBeenCalledTimes(MAX_PENDING_CAPTURES)
  expect(capture.mock.calls[0]).toEqual([EVENTS.PHOTO_CAPTURED, { n: 5 }])
})
