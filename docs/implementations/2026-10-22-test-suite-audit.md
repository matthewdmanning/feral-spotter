# Test suite audit

**Purpose:** remove tests and substitutes that can pass while application behavior
is broken, and use testing support shipped by the installed libraries.

**Change:** replaced the permissive Unistyles proxy with its official mock and
real app themes; removed duplicated AsyncStorage/MMKV mocks; used MMKV's built-in
in-memory implementation, Reanimated's public mock, and the supplied Worklets
resolver. Expo location overrides retain real exports and preset native mocks.
The active-cat and captured-photo suites now use real persisted stores, and
analytics consent checks real state. Sign-in and Onboarding render real AppButtons.

Press, long-press, and typing tests now await User Event interactions. Submit/reset
and cache-sync tests await real dialog callbacks instead of firing unobserved
promises or counting microtasks. The sign-in failure test waits for error handling.
Removed a duplicate pending-location test, subsumed model cases, a shallow empty
AlertHost check, and a still-uploading check superseded by the timeout/draft-survival
case. Replaced the formatting-sensitive touch-target source scanner with a rendered
shared-button floor check and disabled/loading interaction coverage. AlertHost
checks actual dismissal and chained rendering.

Testing resources and guidance are recorded in [testing.md](../agents/testing.md).
No production behavior changes are intended.

## Verification

The completed application audit passes 78 suites / 360 tests. Root type checks, changed-file ESLint, formatting, and diff checks pass. The original app baseline was 76 suites / 352 tests; eight weak cases were removed during initial cleanup and focused regression cases added during remediation. No application behavior was changed.

Backend/emulator validation and independent audit evidence are recorded in the following audit step. Native/device behavior remains unverified by Jest.
