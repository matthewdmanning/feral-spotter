# Android device smoke tests

**Scope** Development tooling

**Issue** [#508](https://github.com/matthewdmanning/feral-spotter/issues/508)

**Date** 2026-11-24

## What shipped

- Maestro runs a fresh onboarding flow followed by photo capture, a Cat
  Form save, and Submission. The Cat Form probe reuses the steps through the
  return to Cat List so the hierarchy can be checked independently.
- The device runner starts the local Firebase suite and seeds a verified
  account. The smoke pass requires both Submission objects in Storage.
- Emulator-backed Android release builds permit cleartext to the local
  emulator hosts. Run and build commands are in
  [test-driving.md](../agents/test-driving.md#android-smoke-suite-with-maestro).

## Verification

- Parsed the Maestro YAML and checked suite tags, package IDs and subflow
  references. Verified the Expo plugin applies the manifest resource for
  emulator-backed builds.
- Used the real Auth and Storage emulators with simulated ADB and Maestro
  commands. The runner seeded a verified account, accepted a complete pair,
  rejected a missing photo, and cleaned up its reverse tunnels.
- Type checking, the Functions build, and 12 focused camera, Annotate and Cat Form tests passed.
- A physical Android run is pending, including the Cat Form hierarchy check
  and the end-to-end Storage assertion from an app submission.
