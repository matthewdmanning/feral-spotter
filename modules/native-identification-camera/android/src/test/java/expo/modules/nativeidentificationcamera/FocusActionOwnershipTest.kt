package expo.modules.nativeidentificationcamera

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The failure this guards: a subject-region clear or stale CameraX callback
 * cancels or reports a newer tap action. These transitions exercise ownership,
 * replacement, cancellation and teardown without mocking CameraX.
 */
class FocusActionOwnershipTest {
  /** Use this function to verify that subject cancellation leaves a tap current. */
  @Test
  fun subjectCancellationDoesNotCancelTap() {
    val ownership = FocusActionOwnership()
    val tap = ownership.begin(FocusActionOwner.TAP)

    assertFalse(ownership.cancelIfOwned(FocusActionOwner.SUBJECT) != null)
    assertTrue(ownership.isCurrent(tap))
  }

  /** Use this function to verify that a newer action makes an older callback stale. */
  @Test
  fun newerActionMakesOlderCallbackStale() {
    val ownership = FocusActionOwnership()
    val subject = ownership.begin(FocusActionOwner.SUBJECT)
    val tap = ownership.begin(FocusActionOwner.TAP)

    assertFalse(ownership.isCurrent(subject))
    assertTrue(ownership.isCurrent(tap))
    assertFalse(ownership.markCompletionReported(subject))
  }

  /** Use this function to verify that completion does not release subject ownership before clear. */
  @Test
  fun completedSubjectActionStillCancelsAndTapDoesNot() {
    val ownership = FocusActionOwnership()
    val subject = ownership.begin(FocusActionOwner.SUBJECT)

    assertTrue(ownership.markCompletionReported(subject))
    assertFalse(ownership.markCompletionReported(subject))
    assertNotNull(ownership.cancelIfOwned(FocusActionOwner.SUBJECT))
    assertFalse(ownership.isCurrent(subject))

    val tap = ownership.begin(FocusActionOwner.TAP)
    assertTrue(ownership.markCompletionReported(tap))
    assertFalse(ownership.cancelIfOwned(FocusActionOwner.SUBJECT) != null)
    ownership.invalidateAll()
    assertFalse(ownership.isCurrent(tap))
  }
}
