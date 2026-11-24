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

/** One-or-many copy: `other` takes a `{count}` slot. */
export interface CountCopy {
  one: string
  other: string
}

/** Pick the count form and fill its slots; `count` is always available. */
export function formatCount(
  forms: CountCopy,
  count: number,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return formatCopy(count === 1 ? forms.one : forms.other, {
    ...values,
    count,
  })
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
// Sightings tab copy owner.
export const historyCopy = {
  readFailed: 'Your sightings could not be loaded.',
  retry: 'Retry',
  loading: 'Loading sightings',
  title: 'Sightings',
  total: '{count} total',
  emptyTitle: 'No sightings yet',
  emptyBody: 'Draft and submitted sightings appear here as you create them',
  notFoundTitle: 'Sighting not found',
  notFoundBody: 'It is no longer saved on this device.',
  catsRecorded: 'Cats Recorded',
  noCats: 'No cats recorded.',
  catProfile: 'Profile Pic of cat {number}',
  photoCount: { one: '1 photo', other: '{count} photos' },
  card: 'Sighting, {status}, {when}',
  resumeHint: 'Continues this sighting',
  openHint: 'Opens the Sighting’s details',
  map: {
    one: 'Map of 1 sighting spot',
    other: 'Map of {count} sighting spots',
  },
  /** Display words for each stored status (CacheStatus). */
  statuses: {
    'In Progress': 'In Progress',
    Submitted: 'Submitted',
    Sending: 'Sending',
    Failed: 'Failed',
  },
  /** Sighting detail rows: answers, never the controls that set them. */
  detail: {
    timeFrom: 'Time from',
    location: 'Location',
    locationFrom: 'Location from',
    gpsAccuracy: 'GPS accuracy',
    accuracyValue: '±{meters} m',
    injuredCat: 'Injured cat',
    yes: 'Yes',
    photos: 'Photos',
    cats: 'Cats',
    notRecorded: 'Not recorded',
    coordinates: '{latitude}, {longitude}',
    locationSources: {
      device: 'Phone GPS',
      pin: 'Picked on map',
      address: 'Address entered',
    },
    timeSources: {
      device: 'Time of submission',
      manual: 'Entered by you',
      metadata: 'Photo timestamp',
    },
  },
} as const

export const commonCopy = {
  cancel: 'Cancel',
  ok: 'OK',
  error: 'Error',
  brand: 'FeralSpotter',
  notAvailable: 'not available',
  notConfigured: 'not configured',
  confirm: 'Confirm',
  save: 'Save',
  remove: 'Remove',
  reset: 'Reset',
  finish: 'Finish',
  edit: 'Edit',
  delete: 'Delete',
  clear: 'Clear',
  skip: 'Skip',
  back: 'Back',
  exit: 'Exit',
  goBack: 'Go Back',
  previous: 'Previous',
  labelledValue: '{label}: {value}',
  labelledChoice: '{label} — {value}',
  somethingWentWrong: 'Something went wrong',
  unknownTime: 'Unknown time',
  catProfilePicture: 'Profile picture of the cat',
} as const

// App-wide error screen (ErrorBoundary) copy owner.
export const errorCopy = {
  title: 'Something went wrong',
  subtitle: 'An unexpected error occurred. Please try again.',
  details: 'Error Details:',
  tryAgain: 'Try Again',
} as const

// Annotate copy owner. Tutorial steps stay in annotate/config/tutorial.ts.
export const annotateCopy = {
  counter: '{current} / {total}',
  removePhoto: 'Remove photo',
  removeTitle: 'Remove photo from submission?',
  removeMessage: 'This cannot be undone.',
  removeDontAsk: 'Remove, don’t ask again',
  firstPhoto: 'You are on the first photo of {count}.',
  previous: '← Previous',
  notInPhoto: 'Not in Photo',
  notInPhotoAccessibility: 'Not in this photo',
  doneWithCat: 'Done With This Cat',
  photo: 'Cat observation photo',
  crop: 'Cropped photo of the cat being described',
  expandCrop: 'Expand cat photo preview',
  collapseCrop: 'Collapse cat photo preview',
  growBox: 'Grow box',
  shrinkBox: 'Shrink box',
  resizeLeft: 'Resize box width, left edge',
  resizeRight: 'Resize box width, right edge',
  resizeTop: 'Resize box height, top edge',
  resizeBottom: 'Resize box height, bottom edge',
} as const

// Camera copy owner.
export const cameraCopy = {
  permissionTitle: 'Camera Access Required',
  permissionBody:
    'FeralSpotter needs camera access to capture cat observations.',
  allowCamera: 'Allow Camera',
  noCamera: 'No Camera Found',
  unavailableTitle: 'Camera Unavailable',
  unavailableBody:
    'This sighting uses library photos. Finish or reset it on Home to take photos.',
  close: 'Close camera',
  done: 'Done ({count})',
  flash: { off: 'Flash off', on: 'Flash on', auto: 'Flash auto' },
  flashAutoBadge: 'A',
  switchCamera: 'Switch camera',
  captureMode: 'Capture',
  captureModeAccessibility: 'Capture mode',
  modes: { single: 'Single', burst: 'Burst' },
  capturePhoto: 'Capture photo',
  startBurst: 'Start burst',
  stopBurst: 'Stop burst',
  discardPhoto: 'Discard photo',
  photoOf: 'Photo {number} of {count}',
} as const

// Photo Library copy owner.
export const libraryCopy = {
  accessTitle: 'Photo library access needed',
  accessMessage:
    'Choose from Library needs access to your photos. Enable it in Settings, then try again.',
  openFailedTitle: 'Could not open your photos',
  openFailedMessage: 'Try again.',
  skippedTitle: 'Some photos were skipped',
  skippedMessage: 'Only JPEG, PNG and HEIC photos can be added.',
} as const

// Device-permission gate copy owner; consent disclosures stay in
// permissions/copy/.
export const permissionCopy = {
  blockedTitle: 'Permission Blocked',
  blockedBody:
    'Camera, photo, or location access was denied. Enable it in Settings to continue — you’ll be brought back here automatically once it’s granted.',
  requestFailedMessage: 'Could not process permissions. Please try again.',
} as const

// No-photos prompt copy owner (#503): shown instead of an empty Annotate.
export const noPhotosCopy = {
  title: 'No Photos to Annotate',
  message: 'Get more photos, or describe a cat without boxing it.',
  takePhotos: 'Take Photos',
  uploadPhotos: 'Upload Photos',
  justDescribe: 'Just Describe',
  backToCatList: 'Back to Cat List',
  cancelSighting: 'Cancel Sighting',
} as const

// Auth copy owner.
export const authCopy = {
  signInSubtitle: 'Sign in to start submitting cat observations.',
  signIn: 'Sign in',
  createOne: 'Create one',
  noAccount: 'No account? ',
  divider: 'or',
  name: 'Name',
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
  verifyEmailTitle: 'Verify your email',
  verifyEmailBeforeSubmitting:
    'Verify your email address to submit a Sighting.',
  verificationSentMessage:
    'Follow the link in your email, then try submitting again.',
  verificationSendFailedTitle: 'Could not send verification email',
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
  missingNameTitle: 'Missing name',
  missingNameMessage: 'Enter the name organization members will see.',
  missingEmailTitle: 'Missing email',
  missingEmailMessage: 'Enter an email address.',
  weakPasswordTitle: 'Weak password',
  minimumPasswordLengthMessage: 'Use at least {minimumLength} characters.',
  passwordsDoNotMatchTitle: 'Passwords do not match',
  passwordsDoNotMatchMessage: 'Re-enter the same password in both fields.',
} as const

// Organization copy owner.
export const organizationCopy = {
  loading: 'Loading organizations…',
  errors: {
    invalid: 'Check your invite code or sharing choices and try again.',
    sessionExpired: 'Your session has expired. Sign in again to continue.',
    accessLost:
      'You no longer have access. Refresh your memberships to check their status.',
    unavailable: 'The invite, organization, or shared sighting is unavailable.',
    changed:
      'Choices changed. Refresh and review again, or resume the pending leave operation.',
    timedOut:
      'The request timed out. A change may still complete; refresh before retrying.',
    limit:
      'The service limit was reached. Retry later, or leave without retaining shares.',
    serviceUnavailable:
      'The organization service is temporarily unavailable. Please retry.',
    connection: 'Unable to connect. Check your connection and retry.',
    unexpected: 'Unable to complete this request. Please retry.',
  },
  pinInteractions: {
    comments: 'Comments',
    loadingComments: 'Loading comments…',
    loadingReactions: 'Loading reactions…',
    updatingReaction: 'Updating reaction…',
    noComments: 'No comments yet.',
    you: 'You',
    formerMember: 'Former member',
    delete: 'Delete',
    deleting: 'Deleting…',
    deleteOwnComment: 'Delete your comment',
    loadMore: 'Load more comments',
    retryComments: 'Retry comments',
    retryReactions: 'Retry reactions',
    addComment: 'Add a comment',
    postComment: 'Post comment',
    posted: 'Posted',
    commentLimit:
      'You reached the comment limit. Delete old comments to post more.',
    reaction: '{label}, {count}',
    reactionFace: '{emoji} {count}',
  },
  membership: {
    title: 'Organizations',
    signIn: 'Sign in to join an organization.',
    offline: 'Connect to manage memberships.',
    loading: 'Loading memberships…',
    refresh: 'Refresh memberships',
    join: 'Join an organization',
    disclosure:
      'Members see your account name. Joining does not share sightings or contact details.',
    nameRequired: 'Your account needs a name to join an organization.',
    inviteCode: 'Invite code',
    request: 'Request membership',
    empty: 'No memberships or pending requests.',
    statuses: {
      pending: 'Pending approval',
      active: 'Active member',
      rejected: 'Request declined',
      removed: 'Membership removed',
      left: 'Membership ended',
    },
    leavingIncomplete: 'Leaving incomplete',
    resumeLeaving: 'Resume leaving',
    members: 'Members',
    cancelLeaving: 'Cancel leaving',
    cancelRequest: 'Cancel request',
    leave: 'Leave organization',
    memberCount: { one: '1 member', other: '{count} members' },
    locationNear: 'Near {latitude}, {longitude}',
    arrange: 'Arrange',
    saveOrder: 'Save',
    move: 'Move {name}',
  },
  leave: {
    disclosure:
      'Leaving unshares all your sightings unless you retain sharing. Copies already received cannot be recalled.',
    keep: 'Keep sharing my existing sightings',
    retainedDisclosure:
      'Retained shares include cat count and approximate area. Future sightings are not shared automatically.',
    anonymousDisclosure: 'Anonymous shares exclude your name, email and phone.',
    contactDisclosure:
      'Selected contact details are shared with the organization. Member views exclude contact information.',
    review: 'Review retained sharing',
    reviewSummary:
      '{count} existing sightings retain these sharing permissions.',
    reviewFailed:
      'Current shares are unavailable. Retry or leave and unshare all sightings.',
    incomplete:
      'Leaving is incomplete. Refresh memberships to check its status.',
    confirmKeep: 'Confirm sharing and leave',
    confirmRevoke: 'Leave and unshare all my sightings',
  },
  overview: {
    title: 'Organization',
    privacy: 'Privacy settings',
    closePrivacy: 'Close privacy settings',
    privacyDescription: 'Members see your account name.',
    open: 'View {name}',
    signIn: 'Sign in to view your organization.',
    offline: 'Connect to load your organization.',
    unavailable: 'This organization is not in your memberships.',
    loading: 'Loading organization…',
    refresh: 'Refresh organization',
    sharedSightings: 'Shared Sightings',
  },
  sharedSightings: {
    title: 'Shared Sightings',
    mapNotice:
      'Shaded areas show approximate locations. Pins show precise locations shared by the observer.',
    mapLabel: 'Shared Sightings map. Shaded areas are approximate locations.',
    signIn: 'Sign in to view shared sightings.',
    unavailable: 'Organization sharing is currently unavailable.',
    loading: 'Loading shared sightings…',
    offline: 'Connect to view shared sightings.',
    refresh: 'Refresh shared sightings',
    empty: 'No shared sightings.',
    emptyPage: 'No shared sightings on this page. Load more to continue.',
    loadMore: 'Load more sightings',
    item: 'Sighting {number}: {cats} · {location}',
    preciseLocation: 'Precise location',
    approximateArea: 'Approximate area',
    catCount: { one: '1 cat', other: '{count} cats' },
    preciseValue: '{latitude}, {longitude}',
    areaValue:
      'Approximate area: {south} to {north} latitude, {west} to {east} longitude',
    cat: 'Cat {number}',
    photo: 'Shared cat photo {number}',
    loadingPhoto: 'Loading photo…',
    retryPhoto: 'Retry photo',
  },
  members: {
    title: 'Members',
    notice: 'Only display names are shared in this list.',
    signIn: 'Sign in to view members.',
    offline: 'Connect to view members.',
    loading: 'Loading members…',
    refresh: 'Refresh members',
    empty: 'No members to display.',
    emptyPage: 'No members on this page. Load more to continue.',
    loadMore: 'Load more members',
  },
  listSeparator: ', ',
  sharingSettings: {
    title: 'Organization sharing',
    description:
      'Choose what to offer every organization you select. Each sighting still needs your confirmation.',
    includedNotice:
      'Cat count and an approximate area are always included when you share.',
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
    revokeSightingMessage:
      'Revoke {organization}’s access to this sighting? This stops future access. Copies already received cannot be recalled.',
    revokeSharedSightingMessage:
      'Revoke {organization}’s access to the sighting shared {date}? This stops future access. Copies already received cannot be recalled.',
    revokeOrganizationMessage:
      'Revoke {organization}’s access to all your sightings, including pending permissions? This stops future access. Copies already received cannot be recalled.',
    noPermissions:
      'No saved or pending sharing permissions for this organization.',
    sightingDetails: 'Sighting shared {date}: {fields}',
    revokeNamedSighting: 'Revoke access to the sighting shared {date}',
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

/** LOGIC-5: by the upload admission's refusal reason. */
const uploadRefusedCopy: Readonly<Record<string, string | undefined>> = {
  too_many_open_submissions:
    'Too many sightings are uploading at once. This sighting is saved on this device. Try again in 30 minutes.',
  submission_cap_reached:
    'This account has reached its sighting limit. This sighting is saved on this device.',
  quota_exceeded:
    'Your photo storage limit is reached. This sighting is saved on this device.',
  email_verification_required:
    'Verify your email address. This sighting is saved on this device.',
  account_erasing: 'This account is being deleted. Photos cannot upload.',
}

// Submission copy owner.
export const submissionCopy = {
  /** The submit button (cat-list-empty-state.md). */
  finishedLabel: 'Finished!',
  location: {
    accuracyUncertainAccessibility: 'Location accuracy is low or unavailable',
    manualAccessibility: 'Edit location',
    acquiredAccessibility: 'Location acquired',
    label: 'Location',
  },
  time: {
    unknown: 'Time unknown',
    recorded: 'Date & Time Recorded',
  },
  /** Create screen (the Sighting summary). */
  create: {
    title: 'Sighting',
    catsRecorded: 'Cats Recorded',
    cat: 'Cat: {label}',
    noCats:
      'No cats recorded. Pick one out of your photos, or describe a cat you saw. Your photos are still here either way.',
    annotatePhotos: 'Annotate Photos',
    addCat: 'Add a Cat',
    describeCat: 'Describe a Cat',
    finishNeedsCat: 'Describe at least one cat before you finish.',
    takeMorePhotos: 'Take More Photos',
    selectMorePhotos: 'Select More Photos',
  },
  /** Why a Home photo entrypoint is disabled; one full sentence per case. */
  photoNotice: {
    restored: {
      camera:
        'You have an unfinished sighting with camera photos. Finish or reset it to use Upload Photos.',
      library:
        'You have an unfinished sighting with library photos. Finish or reset it to use Take Photos.',
    },
    inSession: {
      camera:
        'This sighting uses camera photos. Reset it to use Upload Photos.',
      library:
        'This sighting uses library photos. Reset it to use Take Photos.',
    },
  },
  photoLimitTitle: 'Photo limit reached',
  photoLimitMessage:
    'A Sighting holds up to {max} photos. Remove one to add another.',
  dateTime: {
    selectDate: 'Select Date',
    selectTime: 'Select Time',
    selectDateTime: 'Select Date & Time',
    date: 'Date',
    time: 'Time',
  },
  locationPicker: {
    placePin: 'Drag the map to place the pin',
    noLocation: 'No location yet. Drag the map to where you saw the cat.',
    setLocation: 'Set location',
  },
  /** Cat form screen and its dialogs. */
  cat: {
    editTitle: 'Edit Cat',
    newTitle: 'Observed Cat',
    removeThisCat: 'Remove this Cat',
    coat: 'Coat and color',
    healthAccessibility: 'Cat health rating',
    profilePic: 'Profile Pic',
    profilePicChoose: 'Choose the photo that shows this cat best.',
    profilePicSingle: 'Box this cat in another photo to choose between them.',
    useProfilePic: 'Use photo {number} of {count} as Profile Pic',
    photo: 'Photo {number}',
    clearTitle: 'Clear form?',
    clearMessage: 'All fields will be cleared. This cannot be undone.',
    unsetFields: { one: '1 field not set', other: '{count} fields not set' },
    unsetField: '• {field}',
    saveAnyway: 'Save anyway',
    removeTitle: 'Remove this cat?',
    removeMessage:
      'This removes the cat and the boxes you drew for it. Your photos are not deleted, and your other cats are not affected.',
    abandonMessage:
      'You haven’t saved this cat. Leaving now removes the boxes you drew for it and anything you filled in here. Your photos and any other cats are not affected.',
    abandonAction: 'Remove progress on this cat',
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
    uploadRefusedTitle: 'Photos Could Not Upload',
    failedTitle: 'Sighting Failed',
    submitTitle: 'Submit Sighting',
    cancel: commonCopy.cancel,
    submit: 'Submit',
    uploadStalled:
      'Your photos did not finish uploading. This sighting is saved on this device. Check your connection.',
    uploadRefused: uploadRefusedCopy,
    failed:
      'The sighting did not reach the server. It is saved on this device. Not sent yet.',
    confirm: 'Submit {catCount} {catLabel} and {photoCount} {photoLabel}?',
    cat: 'cat',
    cats: 'cats',
    photo: 'photo',
    photos: 'photos',
  },
} as const
