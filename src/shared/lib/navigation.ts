import { router } from 'expo-router'

/**
 * Leaves any flow for Home. Pops back to the Home already at the root of the
 * stack, so Back cannot reopen the Camera or a submission screen left
 * beneath it. `router.replace('/')` swapped only the top screen and left
 * them there (#453). If Home is not on the stack, it is added in place of
 * the current screen.
 */
export function goHome(): void {
  router.dismissTo('/')
}
