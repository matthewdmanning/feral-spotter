/** One runtime ceiling for all app-owned text; OS-owned UI keeps its own policy. */
export const MAX_FONT_SIZE_MULTIPLIER = 2

/** Replace named slots once; inserted account/catalog data is never reinterpreted. */
export function formatCopy(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : slot,
  )
}

/** Shared route titles and gate labels; route/schema keys stay in the routers. */
export const navigationCopy = {
  home: 'Home',
  settings: 'Settings',
  sighting: 'Sighting',
  sightings: 'Sightings',
  createAccount: 'Create account',
  consent: 'Before You Start',
  agreement: 'Data Usage Agreement',
  submissionDetails: 'Submission Details',
  catObservations: 'Cat Observations',
  locateCat: 'Locate Cat',
  pickLocation: 'Pick Location',
  openSettings: 'Open settings',
  openSystemSettings: 'Open Settings',
  preparingSighting: 'Preparing Your Sighting',
  goHome: 'Go Home',
  restoreFailed: 'Could Not Restore Your Sighting',
  restartToRetry: 'Restart the app to try again.',
  continueSighting: 'Continue Sighting',
  newSighting: 'New Sighting',
  takePhotos: 'Take Photos',
  uploadPhotos: 'Upload Photos',
} as const

/** Bundled UI copy: changes ship with the next app bundle. User data stays separate. */
export const commonCopy = {
  cancel: 'Cancel',
  ok: 'OK',
  error: 'Error',
  brand: 'FeralSpotter',
  notAvailable: 'not available',
  notConfigured: 'not configured',
} as const

// Auth copy owner.
export const authCopy = {
  signInSubtitle: 'Sign in to start submitting cat observations.',
  signIn: 'Sign in',
  createOne: 'Create one',
  noAccount: 'No account? ',
  divider: 'or',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  missingDetailsTitle: 'Missing details',
  missingDetailsMessage: 'Enter your email and password.',
  signInFailedTitle: 'Sign-in failed',
  emailSignInFailedMessage: 'Check your email and password, then try again.',
  providerSignInFailedMessage:
    'Something went wrong signing in. Please try again.',
  providerGoogle: 'Continue with Google',
  providerApple: 'Continue with Apple',
  providerFacebook: 'Continue with Facebook',
  comingSoonTemplate: '{provider} (coming soon)',
  registrationTitle: 'Create your account',
  registrationSubtitle: 'Sign up with an email and password.',
  registrationFailedTitle: 'Registration failed',
  registrationFailedMessage:
    'Could not create the account. Try a different email.',
  addEmail: 'Add email',
  addEmailTitle: 'Add your email',
  sendVerificationLink: 'Send verification link',
  checkYourEmailTitle: 'Check your email',
  emailChangeSentMessage:
    'We sent a link to {email}. Your email changes once you follow it.',
  validEmailMessage: 'Enter a valid email address',
  changeEmailFailedTitle: 'Could not change email',
  recentSignInRequiredMessage:
    'Sign out and sign in again, then try once more.',
  retryMessage: 'Something went wrong. Please try again.',
} as const

// Validation copy owner.
export const validationCopy = {
  missingCatObservation: 'At least one cat observation is required.',
  missingPhoto: 'At least one photo is required.',
  missingEmailTitle: 'Missing email',
  missingEmailMessage: 'Enter an email address.',
  weakPasswordTitle: 'Weak password',
  minimumPasswordLengthMessage: 'Use at least {minimumLength} characters.',
  passwordsDoNotMatchTitle: 'Passwords do not match',
  passwordsDoNotMatchMessage: 'Re-enter the same password in both fields.',
} as const

// Organization copy owner.
export const organizationCopy = {
  listSeparator: ', ',
  sharingSettings: {
    title: 'Organization sharing',
    description:
      'Choose what to offer every organization you select. Each sighting still needs your confirmation.',
    includedNotice:
      'Cat count and an approximate area are always included when you share. Anonymous is checked by default on each sighting and overrides name, email, and phone.',
    shareFieldLabels: {
      name: 'Share name',
      email: 'Share email',
      phone: 'Share phone',
      catDetails: 'Share cat details',
      preciseLocation: 'Share precise location',
      photos: 'Share photos',
    },
    nameField: 'Name to share',
    emailValue: 'Email to share: {email}',
    emailUnavailable: 'No email available',
    phoneField: 'Phone to share',
    save: 'Save sharing preferences',
  },
  submission: {
    title: 'Share with organizations',
    injuredCat: 'Report an injured cat',
    noContactNotice:
      'This does not contact or notify an organization. No rescue response is requested.',
    locationNeeded:
      'Set this sighting’s location to find organizations that cover the area.',
    updatingCoverage: 'Updating organizations…',
    savedCoverage:
      'Using saved coverage from {date}. Choices will be checked when online.',
    coverageUnavailable:
      'Organization coverage is unavailable. Try again later; you can still submit without sharing.',
    connectForCoverage:
      'Connect to load organization coverage. You can still submit without sharing.',
    retryCoverage: 'Retry organization coverage',
    noCoverage: 'No organizations cover this sighting’s location.',
    noSavedCoverage:
      'No saved organizations cover this sighting’s location. Connect to check current coverage.',
    anonymous: 'Anonymous',
    included: 'Included: {fields}.',
    emailValue: 'Email: {email}',
    nameValue: 'Name: {name}',
    phoneValue: 'Phone: {phone}',
    revocationDisclosure:
      'Revoking access stops future access. Copies already received cannot be recalled.',
    confirmSharing: 'Share this sighting',
    declineSharing: 'Don’t share this sighting',
    configureFields: 'Configure shared fields in Settings',
  },
  permissions: {
    title: 'Organization permissions',
    deliveryNotice:
      'Permissions are saved here. Organization delivery is not available yet.',
    anonymousContact: 'Anonymous.',
    contactValue: 'Contact: {contact}.',
    noContactSelected: 'No contact information selected.',
    reviewCurrentCoverage:
      '{organization}: {fields}. {contact} Current coverage will be checked before permission is saved.',
    revokeTitle: 'Revoke organization access?',
    revokeMessage:
      'This stops future access. Copies already received cannot be recalled.',
    revoke: 'Revoke',
    connectToReview: 'Connect to review the current organization coverage.',
    organizationUnavailable:
      'This organization is no longer available. No permission was granted.',
    confirmAgainTitle: 'Confirm sharing again',
    choicesChanged: 'Sharing choices changed. Review this permission again.',
    permissionPending: 'Permission remains pending. Try syncing again.',
    revoked: 'Revoked',
    revocationPending: 'Revocation pending',
    permissionSaved: 'Permission saved',
    permissionStatus: '{organization} · {status}',
    pendingStatus: '{organization}: {status}',
    revokeForSighting: 'Revoke access to this sighting',
    selectedOrganization: 'Selected organization',
    notSharedReview: 'Not shared — review required',
    permissionPendingConnection: 'Permission pending connection',
    reviewSharing: 'Review sharing',
    cancelPermission: 'Cancel sharing permission',
    revokeAllForOrganization: 'Revoke all access for {organization}',
    revocationPendingConnection:
      'Revocation pending connection. Access is revoked when the server acknowledges it.',
    retrySync: 'Retry permission sync',
  },
  fieldLabels: {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    catDetails: 'Cat details',
    preciseLocation: 'Precise location',
    photos: 'Photos',
  },
  includedSummary: {
    catCount: 'cat count',
    approximateArea: 'approximate area',
  },
  confirmationError:
    'Review the organization choices and confirm “Share this sighting”, or choose not to share.',
} as const

// Submission copy owner.
export const submissionCopy = {
  location: {
    accuracyUncertainAccessibility:
      'Location accuracy is low or unavailable — tap to set manually',
    manualAccessibility: 'Edit location',
    acquiredAccessibility: 'Location acquired',
  },
  exit: {
    clearFailedTitle: 'Could Not Clear Draft',
    clearFailedMessage:
      'Your draft could not be cleared. Restart the app and try again.',
    cameraRollNote: ' Copies saved to your camera roll stay there.',
    resetTitle: 'Reset Sighting',
    resetMessage:
      'This will permanently clear all cats, photos and sighting data.{cameraRollNote}',
    resetAction: 'Reset',
    newSightingTitle: 'Start a New Sighting?',
    newSightingMessage:
      'This clears the cats, photos and details of your current sighting.{cameraRollNote}',
    newSightingAction: 'Start New',
    leaveTitle: 'Leave Submission?',
    leaveMessage: 'Your draft is not sent yet.',
    stay: 'Stay',
    discardDraft: 'Discard Draft',
  },
  alerts: {
    incompleteTitle: 'Sighting Incomplete',
    sharingUnconfirmedTitle: 'Confirm organization sharing',
    uploadStalledTitle: 'Photos Still Uploading',
    failedTitle: 'Sighting Failed',
    submitTitle: 'Submit Sighting',
    cancel: commonCopy.cancel,
    submit: 'Submit',
    uploadStalled:
      'Your photos did not finish uploading. This sighting is saved on this device. Check your connection, then tap Submit Sighting to send it again.',
    failed:
      'The sighting did not reach the server. It is saved on this device. Tap Submit Sighting to send it again.',
    confirm: 'Submit {catCount} {catLabel} and {photoCount} {photoLabel}?',
    cat: 'cat',
    cats: 'cats',
    photo: 'photo',
    photos: 'photos',
  },
} as const
