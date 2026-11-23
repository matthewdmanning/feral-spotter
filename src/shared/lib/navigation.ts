import { type Href, router } from 'expo-router'

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

/**
 * Opens `href` as the only screen on the stack. A finished flow uses it so
 * Back cannot reopen the screens that led there: a replace swapped only the
 * top one, so Registration left Sign-in beneath Home.
 */
export function startOver(href: Href): void {
  if (router.canDismiss()) router.dismissAll()
  router.replace(href)
}
