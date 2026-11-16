package expo.modules.nativeidentificationcamera

/**
 * The owner of a CameraX focus-and-metering action, so a subject update cannot
 * cancel a tap action that was started later or belongs to a different owner.
 */
internal enum class FocusActionOwner {
  TAP,
  SUBJECT
}

/**
 * Represents the current focus action generation and guards asynchronous
 * CameraX completion callbacks against newer actions and camera teardown.
 */
internal data class FocusActionToken(
  val generation: Long,
  val owner: FocusActionOwner
)

/**
 * Tracks focus-action ownership independently of CameraX so cancellation and
 * stale-callback rules can be tested without a camera or Android lifecycle.
 */
internal class FocusActionOwnership {
  private var generation = 0L
  private var current: FocusActionToken? = null
  private var completionReported: FocusActionToken? = null

  /** Use this function to mark a new tap or subject focus action as current. */
  fun begin(owner: FocusActionOwner): FocusActionToken {
    val token = FocusActionToken(++generation, owner)
    current = token
    completionReported = null
    return token
  }

  /** Use this function to check whether a completion callback is still current. */
  fun isCurrent(token: FocusActionToken): Boolean = current == token

  /** Use this function to report one completion without releasing active metering ownership. */
  fun markCompletionReported(token: FocusActionToken): Boolean {
    if (current != token || completionReported == token) return false
    completionReported = token
    return true
  }

  /** Use this function to cancel only the current action owned by the requested source. */
  fun cancelIfOwned(owner: FocusActionOwner): FocusActionToken? {
    val token = current?.takeIf { it.owner == owner } ?: return null
    current = null
    completionReported = null
    generation += 1
    return token
  }

  /** Use this function to invalidate callbacks when the camera session is torn down. */
  fun invalidateAll() {
    current = null
    completionReported = null
    generation += 1
  }
}
