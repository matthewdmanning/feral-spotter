# First-run flow order — current design state

Screen sequence a new user walks through before reaching Home, and where each gate/permission-request fires.

## Order

`intro-flow -> consent -> sign-in -> analytics-consent -> home`

## Why consent moved ahead of sign-in

Root motivation: permissions were presented too late in the old order. Moving consent ahead of sign-in means a user who declines does not have to create an account before reaching a functional app state.

Consent remains a single step so the user sees and agrees to the data-collection disclosure before the related permission prompts.

## Why analytics-consent did not move

Analytics consent stays after sign-in and before Home because analytics is optional and the app remains usable without it.

## Home's auth/consent gate

Home checks consent before authentication. A consented but signed-out user goes to sign-in and does not repeat onboarding or consent.
