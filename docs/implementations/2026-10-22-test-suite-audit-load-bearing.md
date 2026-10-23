# Load-bearing test reassessment

## Primary conclusion

**Prioritize assertions that distinguish broken application behavior from a no-op. Do not equate redundancy, isolation, or a surviving mutation with a useless test.** Six reviewers rechecked all 79 test files using that criterion. The strongest confirmed ineffective assertion is Google sign-out: replacing the operation with an empty function leaves its only sign-out test green. No other scoped test or entire suite was demonstrated to have no useful asserted behavior. Many tests have partial coverage worth strengthening.

A test can fail trivially because an import breaks. That does not earn it a place. Here, a meaningful failure means an assertion rejects a realistic semantic production defect while the code still loads. Conversely, one escaped mutation does not establish that the test never detects anything.

## Executed evidence

| Review area        | Passing isolated baseline | Assertion kills | Surviving defects |
| ------------------ | ------------------------: | --------------: | ----------------: |
| Auth/upload        |       6 suites / 20 tests |               7 |                 3 |
| Hooks              |      20 suites / 95 tests |               9 |                 7 |
| Components/config  |      10 suites / 36 tests |              26 |                 4 |
| Submission screens |      11 suites / 45 tests |              20 |                 4 |
| Other screens      |      11 suites / 56 tests |              11 |                 5 |
| Domain/utilities   |      18 suites / 95 tests |               5 |                 6 |
| **Total**          | **76 suites / 347 tests** |          **78** |            **29** |

The 107 executed probes all produced valid semantic results. No parse/import crash was counted as a kill. Functions and rules (3 files / 43 cases) were reviewed statically; 2 proposed probes remain explicitly blocked. These targeted experiments deliberately investigate suspicious cases and are **not a project-wide mutation score**.

Tests and production code were untouched in the shared workspace. All production mutations ran in private temporary snapshots and were restored. SHA-256 verification confirms all 250 source/config files match the pre-assessment workspace. One initial component baseline timed out at 5 seconds during concurrent work; it passed with a consistent 15-second timeout before mutation results were interpreted.

## Replace the clearest ineffective assertion

[GoogleSignIn.test.ts:26](../../src/lib/auth/__tests__/GoogleSignIn.test.ts#L26), `resolves without error`:

- Mutation: replace `await GoogleSignin.signOut()` with an immediate return.
- Result: all 3 tests in the file still pass, including its sole sign-out case.
- Decision: replace this assertion with verification that the official Google Sign-In mock receives `signOut`. Verify awaiting/rejection behavior if part of the wrapper contract. Keep the two token tests: an empty access token causes an assertion failure.

This is ineffective **with respect to actually signing out**, rather than a mathematical claim that no imaginable edit could ever make it fail.

## Strengthen these partial guards first

| Existing test/contract          | Real defect that remained green                                                      | Evidence that the existing check still has value                                                | Primary decision                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Consent denial models           | Route to sign-in while also rendering Permission Blocked; all 19 consent cases pass  | Removing the blocked UI causes 12 assertion failures; disconnected foreground recovery causes 5 | Assert no navigation and unaccepted consent for every blocked state            |
| Map picker                      | Omit switching to pin mode, or commit during dragging; both cases pass               | Omitting the confirmed location write or Cancel navigation fails                                | Verify mode and move→cancel preserves the original draft                       |
| Cat List                        | Enable Finished with zero cats, or Delete always targets the first cat;12 cases pass | Removing the explanatory text or Delete prompt fails the relevant cases                         | Assert disabled behavior and selected-cat deletion outcome                     |
| Draft teardown                  | Leave Submission metadata or submissionId behind;4 cases pass                        | Leaving boxes behind fails both survival invariants                                             | Seed nondefault fields and assert legitimate persisted reset defaults          |
| Capture dimension contract      | Swap dimensions or return 1×1;8 cases pass                                           | Return 0×0 fails all 3 accepted-payload cases                                                   | Compare width and height exactly with distinct input dimensions                |
| Resize canvas limit             | Remove the canvas cap;9 cases pass                                                   | Ignoring the photo limit fails the claimed canvas case and its neighbor                         | Use an input that actually reaches the canvas-limited branch                   |
| Box-to-photo payload mapping    | Give every box the first photo path;10 cases pass                                    | Omitting the path fails the association assertion                                               | Use two distinguishable photos/boxes with reversed map order                   |
| Abandon Cancel                  | Add a destructive Cancel callback; named case passes because it never clicks Cancel  | It still rejects premature deletion before confirmation                                         | Exercise the actual Cancel callback or rendered dialog                         |
| Cat removal                     | Clear another cat’s boxes; removal case passes                                       | Existing cat-list identity checks reject wrong cat removal                                      | Assert remaining box ownership, not just count                                 |
| Gallery-save failure            | Omit gallery saving; review-state case passes                                        | Clearing review state during immediate save rejection fails the case                            | Establish the rejected-save precondition explicitly; retain review-state guard |
| Submission validation           | Omit incomplete-submission feedback; zero-cat/photo cases pass                       | Bypassing validation fails both blocking cases                                                  | Assert the actual error dialog and relevant message                            |
| Bubble settled expansion        | Never emit settled-expanded false; both model journeys pass                          | Wrong eager expanded signal fails both                                                          | Await expansion completion and assert false before collapsing                  |
| Error reporting consent         | Replace AND by OR; both cases pass                                                   | Removing reporting fails the positive case                                                      | Include both mixed-consent states                                              |
| Bubble identity and termination | Wrong cat lookup survives 9 cases; terminate with held=true survives 5 drag cases    | Geometry/gesture defects are independently caught                                               | Add distinguishable cat identity and termination hold-release assertions       |
| Persisted dark startup          | Ignore persisted preference; OS-dark/persisted-dark row still passes                 | Stored-light and cold-start cases fail                                                          | Seed OS light for the stored-dark case                                         |

The matrix and reviewer inventories include exact tests, source locations, mutations, results, and static-only limitations: [machine-readable evidence](2026-10-22-test-suite-audit-load-bearing-evidence.json).

## Retain the legitimate narrow guards

- Firebase auth/storage initialization tests reject missing emulator connections. No-op business methods surviving them expose missing business-operation coverage; they do not make initialization assertions worthless.
- Home callback tests reject wrong destinations. Actual BottomButtonColumn wiring can still be broken without detection; add an interaction check rather than discarding the callback guards.
- Cat Form routing rejects a wrong destination; unset-field tests reject a missing warning; cache forwarding rejects missing Manual time; carousel tests reject missing advancement. Their mocked dependencies do not erase that value. Saving cat state, completing a pass, and persistence outcomes need their own explicit assertions.
- Onboarding tests reject broken forward advancement. A broken Previous button survives because that transition has no coverage. Keep the forward guard and add a backward deviation.
- Home source tests reject incorrect disabled rendering. Their remove/submit events only alter the mock input, so drive actual store actions or narrow the lifecycle claims.
- Redundant model prefixes still fail on real defects. The earlier 22-case consolidation recommendation concerns maintenance and duplicate coverage, **not 22 always-green tests**. It is lower priority than ineffective assertions and false-green contracts.

## Complete 79-file decision inventory

A = ineffective assertion of its intended operation; B = meaningful partial guard; C = useful guard at its stated scope. File rows may contain several types of case. C is not a promise that every side behavior is covered. Executed evidence and static reasoning are distinguished in the linked artifact; only selected cases underwent mutation probes.

### Hooks

| File                                                                                                                                                     | Primary disposition                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts`](../../__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts)                                 | B/C — strengthen partial scenario; keep its real guard            |
| [`src/hooks/__tests__/useAbandonCatGuard.test.ts`](../../src/hooks/__tests__/useAbandonCatGuard.test.ts)                                                 | B/C — strengthen partial scenario; keep its real guard            |
| [`src/hooks/__tests__/useActiveCatFlow.model.test.ts`](../../src/hooks/__tests__/useActiveCatFlow.model.test.ts)                                         | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useAnnotatePass.carouselNav.model.test.ts`](../../src/hooks/__tests__/useAnnotatePass.carouselNav.model.test.ts)                   | C — keep index guards; pass-completion assertion is separate      |
| [`src/hooks/__tests__/useAnnotatePass.removeConfirm.test.ts`](../../src/hooks/__tests__/useAnnotatePass.removeConfirm.test.ts)                           | B/C — strengthen partial scenario; keep its real guard            |
| [`src/hooks/__tests__/useBoundingBoxStore.catColors.test.ts`](../../src/hooks/__tests__/useBoundingBoxStore.catColors.test.ts)                           | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useBoundingBoxStore.test.ts`](../../src/hooks/__tests__/useBoundingBoxStore.test.ts)                                               | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useCameraCapture.controls.model.test.ts`](../../src/hooks/__tests__/useCameraCapture.controls.model.test.ts)                       | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useCameraCapture.test.ts`](../../src/hooks/__tests__/useCameraCapture.test.ts)                                                     | B/C — strengthen partial scenario; keep its real guard            |
| [`src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx`](../../src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx)                                   | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useCatForm.initialSelection.test.ts`](../../src/hooks/__tests__/useCatForm.initialSelection.test.ts)                               | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useCatSubmit.saveNavigation.test.ts`](../../src/hooks/__tests__/useCatSubmit.saveNavigation.test.ts)                               | C — keep routing guard; add save-state integration separately     |
| [`src/hooks/__tests__/useCatSubmit.unsetFieldsWarning.test.ts`](../../src/hooks/__tests__/useCatSubmit.unsetFieldsWarning.test.ts)                       | C — keep warning distinction; add save/cancel outcomes separately |
| [`src/hooks/__tests__/useLibraryPhotoPicker.permissionGate.model.test.ts`](../../src/hooks/__tests__/useLibraryPhotoPicker.permissionGate.model.test.ts) | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useNativeCameraCapture.focus.test.ts`](../../src/hooks/__tests__/useNativeCameraCapture.focus.test.ts)                             | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/usePhotoStore.source.test.ts`](../../src/hooks/__tests__/usePhotoStore.source.test.ts)                                             | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useRemoveCat.test.ts`](../../src/hooks/__tests__/useRemoveCat.test.ts)                                                             | B/C — strengthen partial scenario; keep its real guard            |
| [`src/hooks/__tests__/useSettingsStore.nativeDefault.test.ts`](../../src/hooks/__tests__/useSettingsStore.nativeDefault.test.ts)                         | C — keep; named regression guard                                  |
| [`src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts`](../../src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts)                           | C — keep current Manual time forwarding guard                     |
| [`src/hooks/__tests__/useSubmissionSubmit.reset.test.ts`](../../src/hooks/__tests__/useSubmissionSubmit.reset.test.ts)                                   | C — keep; named regression guard                                  |

### Auth/upload

| File                                                                                                                                 | Primary disposition                                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [`__tests__/rules/firestore.test.ts`](../../__tests__/rules/firestore.test.ts)                                                       | C — keep; named regression guard; static-only                      |
| [`__tests__/rules/storage.test.ts`](../../__tests__/rules/storage.test.ts)                                                           | B/C — strengthen partial guards; retain useful checks; static-only |
| [`functions/src/__tests__/index.test.ts`](../../functions/src/__tests__/index.test.ts)                                               | B/C — strengthen partial guards; retain useful checks; static-only |
| [`src/lib/auth/__tests__/GoogleSignIn.test.ts`](../../src/lib/auth/__tests__/GoogleSignIn.test.ts)                                   | A/C — replace the sign-out assertion; retain token guards          |
| [`src/lib/auth/__tests__/authProvider.test.ts`](../../src/lib/auth/__tests__/authProvider.test.ts)                                   | C — keep; named regression guard                                   |
| [`src/lib/auth/__tests__/authProviders.test.ts`](../../src/lib/auth/__tests__/authProviders.test.ts)                                 | C — keep; named regression guard                                   |
| [`src/lib/auth/__tests__/firebaseAuthProvider.emulator.test.ts`](../../src/lib/auth/__tests__/firebaseAuthProvider.emulator.test.ts) | C — keep wiring guards; business-method coverage is separate       |
| [`src/lib/upload/__tests__/firebaseUpload.emulator.test.ts`](../../src/lib/upload/__tests__/firebaseUpload.emulator.test.ts)         | C — keep wiring guards; business-method coverage is separate       |
| [`src/lib/upload/__tests__/uploadNewPhoto.queue.test.ts`](../../src/lib/upload/__tests__/uploadNewPhoto.queue.test.ts)               | B/C — strengthen partial guards; retain useful checks              |

### Components/config

| File                                                                                                                                                                     | Primary disposition                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [`__tests__/components/atoms/StatusIcon.test.tsx`](../../__tests__/components/atoms/StatusIcon.test.tsx)                                                                 | C — keep; named regression guard                                          |
| [`src/components/atoms/__tests__/AppButton.test.tsx`](../../src/components/atoms/__tests__/AppButton.test.tsx)                                                           | C — keep; named regression guard                                          |
| [`src/components/atoms/__tests__/ErrorBoundary.test.tsx`](../../src/components/atoms/__tests__/ErrorBoundary.test.tsx)                                                   | B/C — strengthen partial guards; retain useful checks                     |
| [`src/components/atoms/__tests__/SegmentedControl.selectDeselect.model.test.tsx`](../../src/components/atoms/__tests__/SegmentedControl.selectDeselect.model.test.tsx)   | C — keep; named regression guard                                          |
| [`src/components/organisms/__tests__/AlertHost.test.tsx`](../../src/components/organisms/__tests__/AlertHost.test.tsx)                                                   | C — keep; named regression guard                                          |
| [`src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx`](../../src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx) | B/C — strengthen partial guards; retain useful checks                     |
| [`src/components/organisms/__tests__/InsetCropBubble.diameterDerivation.test.tsx`](../../src/components/organisms/__tests__/InsetCropBubble.diameterDerivation.test.tsx) | C — keep; named regression guard                                          |
| [`src/components/organisms/__tests__/InsetCropBubble.dock.test.tsx`](../../src/components/organisms/__tests__/InsetCropBubble.dock.test.tsx)                             | C — keep; named regression guard                                          |
| [`src/components/organisms/__tests__/InsetCropBubble.drag.test.tsx`](../../src/components/organisms/__tests__/InsetCropBubble.drag.test.tsx)                             | C — keep demonstrated gesture guards; assert released hold on termination |
| [`src/config/__tests__/themeMode.test.ts`](../../src/config/__tests__/themeMode.test.ts)                                                                                 | B/C — strengthen partial guards; retain useful checks                     |

### Domain/utilities

| File                                                                                                                                                 | Primary disposition                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`src/lib/__tests__/location.model.test.ts`](../../src/lib/__tests__/location.model.test.ts)                                                         | C — keep; named regression guard                       |
| [`src/lib/__tests__/location.test.ts`](../../src/lib/__tests__/location.test.ts)                                                                     | C — keep; named regression guard                       |
| [`src/lib/annotate/__tests__/boxResize.test.ts`](../../src/lib/annotate/__tests__/boxResize.test.ts)                                                 | B/C — strengthen partial scenario; keep its real guard |
| [`src/lib/annotate/__tests__/catColors.test.ts`](../../src/lib/annotate/__tests__/catColors.test.ts)                                                 | C — keep; named regression guard                       |
| [`src/lib/annotate/__tests__/cropProjection.test.ts`](../../src/lib/annotate/__tests__/cropProjection.test.ts)                                       | C — keep; named regression guard                       |
| [`src/lib/annotate/__tests__/panClamp.test.ts`](../../src/lib/annotate/__tests__/panClamp.test.ts)                                                   | C — keep; named regression guard                       |
| [`src/lib/camera/__tests__/capturedPhotoFiles.test.ts`](../../src/lib/camera/__tests__/capturedPhotoFiles.test.ts)                                   | C — keep; named regression guard                       |
| [`src/lib/home/__tests__/entrypointDiameter.test.ts`](../../src/lib/home/__tests__/entrypointDiameter.test.ts)                                       | C — keep; named regression guard                       |
| [`src/lib/insetCrop/__tests__/collapse.test.ts`](../../src/lib/insetCrop/__tests__/collapse.test.ts)                                                 | C — keep; named regression guard                       |
| [`src/lib/insetCrop/__tests__/diameter.test.ts`](../../src/lib/insetCrop/__tests__/diameter.test.ts)                                                 | C — keep; named regression guard                       |
| [`src/lib/permissions/__tests__/cameraPermission.test.ts`](../../src/lib/permissions/__tests__/cameraPermission.test.ts)                             | C — keep; named regression guard                       |
| [`src/lib/permissions/__tests__/gallerySavePermission.test.ts`](../../src/lib/permissions/__tests__/gallerySavePermission.test.ts)                   | C — keep; named regression guard                       |
| [`src/lib/permissions/__tests__/libraryPermission.test.ts`](../../src/lib/permissions/__tests__/libraryPermission.test.ts)                           | C — keep; named regression guard                       |
| [`src/lib/permissions/__tests__/locationPermission.test.ts`](../../src/lib/permissions/__tests__/locationPermission.test.ts)                         | C — keep; named regression guard                       |
| [`src/lib/submission/__tests__/draft.invariant.test.ts`](../../src/lib/submission/__tests__/draft.invariant.test.ts)                                 | B/C — strengthen partial scenario; keep its real guard |
| [`src/lib/submission/__tests__/payload.test.ts`](../../src/lib/submission/__tests__/payload.test.ts)                                                 | B/C — strengthen partial scenario; keep its real guard |
| [`src/utils/__tests__/buildSubmissionPhotoFromCapture.contract.test.ts`](../../src/utils/__tests__/buildSubmissionPhotoFromCapture.contract.test.ts) | B/C — strengthen partial scenario; keep its real guard |
| [`src/utils/__tests__/libraryPickTime.test.ts`](../../src/utils/__tests__/libraryPickTime.test.ts)                                                   | C — keep; named regression guard                       |

### Other screens

| File                                                                                                                                                       | Primary disposition                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`src/screens/analytics-consent/__tests__/AnalyticsConsentScreen.test.tsx`](../../src/screens/analytics-consent/__tests__/AnalyticsConsentScreen.test.tsx) | C — keep; named regression guard                                         |
| [`src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx`](../../src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx) | C — keep; named regression guard                                         |
| [`src/screens/consent/__tests__/ConsentScreen.cameraGate.model.test.tsx`](../../src/screens/consent/__tests__/ConsentScreen.cameraGate.model.test.tsx)     | B/C — strengthen named lifecycle/gating claims                           |
| [`src/screens/consent/__tests__/ConsentScreen.locationGate.model.test.tsx`](../../src/screens/consent/__tests__/ConsentScreen.locationGate.model.test.tsx) | B/C — strengthen named lifecycle/gating claims                           |
| [`src/screens/consent/__tests__/ConsentScreen.test.tsx`](../../src/screens/consent/__tests__/ConsentScreen.test.tsx)                                       | C — keep; named regression guard                                         |
| [`src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx`](../../src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx)   | C — keep Home callback/focus guards; real column interaction is separate |
| [`src/screens/home/__tests__/HomeScreen.gate.model.test.tsx`](../../src/screens/home/__tests__/HomeScreen.gate.model.test.tsx)                             | C — keep; named regression guard                                         |
| [`src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx`](../../src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx)       | B/C — strengthen named lifecycle/gating claims                           |
| [`src/screens/home/__tests__/HomeScreen.resumeEntry.test.tsx`](../../src/screens/home/__tests__/HomeScreen.resumeEntry.test.tsx)                           | C — keep Home callback/focus guards; real column interaction is separate |
| [`src/screens/intro-flow/__tests__/IntroFlowScreen.test.tsx`](../../src/screens/intro-flow/__tests__/IntroFlowScreen.test.tsx)                             | C — keep forward/back-exit guards; Previous coverage is separate         |
| [`src/screens/sign-in/__tests__/SignInScreen.test.tsx`](../../src/screens/sign-in/__tests__/SignInScreen.test.tsx)                                         | C — keep; named regression guard                                         |

### Submission screens

| File                                                                                                                                                                                       | Primary disposition                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [`src/screens/submission/annotate/__tests__/AnnotateScreen.buttons.test.tsx`](../../src/screens/submission/annotate/__tests__/AnnotateScreen.buttons.test.tsx)                             | C — keep; named regression guard                      |
| [`src/screens/submission/cats/__tests__/CatObservationScreen.insetCropHeaderZone.test.tsx`](../../src/screens/submission/cats/__tests__/CatObservationScreen.insetCropHeaderZone.test.tsx) | C — keep; named regression guard                      |
| [`src/screens/submission/cats/__tests__/attributes.test.ts`](../../src/screens/submission/cats/__tests__/attributes.test.ts)                                                               | C — keep; named regression guard                      |
| [`src/screens/submission/cats/__tests__/summarizeCat.test.ts`](../../src/screens/submission/cats/__tests__/summarizeCat.test.ts)                                                           | C — keep; named regression guard                      |
| [`src/screens/submission/create/__tests__/CreateScreen.addMorePhotosAction.model.test.tsx`](../../src/screens/submission/create/__tests__/CreateScreen.addMorePhotosAction.model.test.tsx) | C — keep; named regression guard                      |
| [`src/screens/submission/create/__tests__/CreateScreen.autoSkipGate.model.test.tsx`](../../src/screens/submission/create/__tests__/CreateScreen.autoSkipGate.model.test.tsx)               | C — keep; named regression guard                      |
| [`src/screens/submission/create/__tests__/CreateScreen.backPrompt.model.test.tsx`](../../src/screens/submission/create/__tests__/CreateScreen.backPrompt.model.test.tsx)                   | C — keep; named regression guard                      |
| [`src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx`](../../src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx)                       | B/C — strengthen partial guards; retain useful checks |
| [`src/screens/submission/create/__tests__/CreateScreen.locationCommit.test.tsx`](../../src/screens/submission/create/__tests__/CreateScreen.locationCommit.test.tsx)                       | C — keep; named regression guard                      |
| [`src/screens/submission/create/__tests__/CreateScreen.locationWarningIcon.model.test.tsx`](../../src/screens/submission/create/__tests__/CreateScreen.locationWarningIcon.model.test.tsx) | C — keep; named regression guard                      |
| [`src/screens/submission/location-picker/__tests__/LocationPicker.model.test.tsx`](../../src/screens/submission/location-picker/__tests__/LocationPicker.model.test.tsx)                   | B/C — strengthen partial guards; retain useful checks |

## Remediation outcome

The surviving outcomes above describe the pre-fix audit. All 29 demonstrated
application gaps now have tests that fail the original semantic mutations.
Twelve additional backend mutations were also caught. See the [implementation
record](2026-10-22-test-suite-audit.md) and `post_remediation` in the evidence JSON
for final validation and limitations.
