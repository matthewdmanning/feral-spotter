/** Bundled UI copy; changes take effect with the next application bundle. */
export const settingsCopy = {
  appearance: 'Appearance',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  hapticFeedback: 'Haptic Feedback',

  communications: 'Communications',
  emailUpdates: 'Email Updates',
  yourEmailTemplate: 'Your email: {email}',
  photos: 'Photos',
  capturePriority: 'Capture Priority',
  capturePrioritySpeed: 'Speed',
  capturePriorityBalanced: 'Balanced',
  capturePriorityQuality: 'Quality',
  developer: 'Developer Mode',
  versionTemplate: 'Version {version}',
  dataPolicy: 'Data Policy',

  account: 'Account',
  deleteAccount: 'Delete Account',
} as const

/** The account deletion guard (#433). */
export const accountDeletionCopy = {
  warningTitle: 'Delete your account?',
  warningBody:
    'Your account, email updates and analytics data will be deleted. Your Sightings stay in the research database unless you delete them too.',
  pastUseBody:
    'Deletion stops any further use of your data. It does not recall data already exported, analyzed or used to train models.',
  alsoDeleteSightings: 'Also delete my Sightings',
  confirm: 'Delete Account',
  sightingsTitle: 'Delete your Sightings too?',
  sightingsBody:
    'Your Sightings and their photos will be deleted from the research database. Photos saved on this device stay.',
  sightingsConfirm: 'Delete Sightings and Account',
  passwordTitle: 'Confirm your password',
  passwordConfirm: 'Confirm',
  deletingTitle: 'Deleting your account',
  deletedTitle: 'Account deleted',
  deletedMessage: 'Your account has been deleted.',
  failedTitle: 'Could not delete account',
  wrongPasswordMessage: 'That password is not correct.',
  recentSignInMessage: 'Sign in again, then delete your account.',
} as const
