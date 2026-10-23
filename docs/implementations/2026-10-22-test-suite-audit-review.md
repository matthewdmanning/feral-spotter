# Complete test-suite review — primary decisions

Follow-up: [the semantic load-bearing reassessment](2026-10-22-test-suite-audit-load-bearing.md) tests realistic defects experimentally and refines the priorities below. Redundant cases are not the same as always-green cases.

Six GPT-6.1 subagents, each using high reasoning effort, reviewed all **79 current test files**. The primary agent checked the strongest findings against test/source code and made the dispositions below. This is a review of the current `test-suite-audit` working tree, including the earlier audit edits. No test or production files were changed during this review.

Coverage: 76 files in the application Jest lane; 2 Firebase rules files; 1 Functions file. The inventory was reconciled against files on disk and Jest discovery. Deleted tests are excluded. No unassigned test files or test files inside Expo Router’s route directory were found.

A passing test is not automatically compliant. Findings distinguish weak existing assertions, intentional isolation, redundant cases, and missing scenarios. **22 cases are recommended for removal; the other accepted test findings call for strengthening existing coverage rather than wholesale deletion.**

## Accepted findings

### F01 — Map picker confirmation and cancellation

**Decision:** Improve both journeys.

Every fixture starts pinned and confirmation checks only coordinates. Removing the production switch from device to pin passes, allowing a later Live fix to overwrite the selection. Cancel never follows a map move, so accidental writes during dragging also pass. Start with a nondefault device location, separate MOVE from SET, assert no committed change before confirmation or after move→cancel, and assert pin mode after move→set.

**Evidence:** [src/screens/submission/location-picker/\_\_tests\_\_/LocationPicker.model.test.tsx:75](../../src/screens/submission/location-picker/__tests__/LocationPicker.model.test.tsx#L75)

### F02 — Cat List disabled action and selected deletion

**Decision:** Improve existing empty-state and deletion scenarios.

The disabled-Finished case asserts only explanation text; enabling the button still passes. The Delete case checks only a dialog title; selecting the wrong cat id still passes. Press Finished with zero cats and check no submission; confirm deleting the second cat and check the first survives. Keep the other wiring and accordion cases.

**Evidence:** [src/screens/submission/create/\_\_tests\_\_/CreateScreen.catListActions.test.tsx:159](../../src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx#L159), [src/screens/submission/create/\_\_tests\_\_/CreateScreen.catListActions.test.tsx:226](../../src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx#L226)

### F03 — Home Resume/New bypass rendered controls

**Decision:** Improve; keep destination coverage.

BottomButtonColumn renders null, then tests directly invoke captured callbacks at lines 160–164. Broken real button wiring passes. Retain the actual column under the supported animation mock and await presses on its rendered controls.

**Evidence:** [src/screens/home/\_\_tests\_\_/HomeScreen.entrypointActions.model.test.tsx:62](../../src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx#L62)

### F04 — Home lifecycle journeys are fixture mutations

**Decision:** Rescope or improve.

REMOVE_LAST and SUBMIT only assign mockSource=null and rerender. They prove a rendering decision, not removal, submission, or actual store subscriptions. Use real photo-store actions for reactivity coverage, or name and structure these honestly as source→rendering cases; preserve the useful disabled-state checks.

**Evidence:** [src/screens/home/\_\_tests\_\_/HomeScreen.photoSourceGate.model.test.tsx:136](../../src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx#L136)

### F05 — Camera denial does not prove consent/navigation stays blocked

**Decision:** Improve the gated-state invariant.

The model checks Permission Blocked text but neither accepted state nor absence of navigation. Calling markAccepted or routing while retaining the mocked screen can pass. Assert the real consent/version state stays unaccepted and router.replace is not called across each denial/recovery journey. A related real-store acceptance journey across Consent and Home should cover versioned acceptance; do not replace every incidental mocked consent dependency indiscriminately.

**Evidence:** [src/screens/consent/\_\_tests\_\_/ConsentScreen.cameraGate.model.test.tsx:145](../../src/screens/consent/__tests__/ConsentScreen.cameraGate.model.test.tsx#L145)

### F06 — Onboarding only checks the first slide and final route

**Decision:** Improve the existing journey.

Repeated Next presses do not verify intermediate headers/body, and no visible Previous transition is exercised. Incorrect intermediate content or a broken Previous handler passes. Assert each shown slide and a Previous→Next deviation; retain focused hardware-back scenarios.

**Evidence:** [src/screens/intro-flow/\_\_tests\_\_/IntroFlowScreen.test.tsx:36](../../src/screens/intro-flow/__tests__/IntroFlowScreen.test.tsx#L36)

### F07 — Bubble model never observes settled expansion

**Decision:** Improve model states and timing.

Every onSettledChange expectation is true; both journeys reverse expansion before it settles. Removing the expanded false notification passes although the host title never receives its fade signal. Add expansion completion and assert false, then verify collapse completion returns true.

**Evidence:** [src/components/organisms/\_\_tests\_\_/InsetCropBubble.collapseFlow.model.test.tsx:99](../../src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx#L99)

### F08 — Bubble fixtures ignore cat identity

**Decision:** Keep geometry/gesture tests; improve fixtures.

All four getFirstBox fakes return the same box regardless of catId. A wrong-cat lookup survives all nine cases. Seed real photo/box stores with distinguishable cats, using a shared local fixture. Direct responder events for drags remain appropriate; they are not a User Event violation.

**Evidence:** [src/components/organisms/\_\_tests\_\_/InsetCropBubble.collapseFlow.model.test.tsx:28](../../src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx#L28), [src/components/organisms/\_\_tests\_\_/InsetCropBubble.diameterDerivation.test.tsx:40](../../src/components/organisms/__tests__/InsetCropBubble.diameterDerivation.test.tsx#L40), [src/components/organisms/\_\_tests\_\_/InsetCropBubble.dock.test.tsx:27](../../src/components/organisms/__tests__/InsetCropBubble.dock.test.tsx#L27), [src/components/organisms/\_\_tests\_\_/InsetCropBubble.drag.test.tsx:25](../../src/components/organisms/__tests__/InsetCropBubble.drag.test.tsx#L25)

### F09 — Crash consent gate cannot distinguish AND from OR

**Decision:** Improve negative cases.

Only false/false and true/true are tested. Gating on either permission alone passes. Add both mixed-consent states and retain the positive error/component-stack check. Local expected-crash logging suppression is not itself a submerged exception.

**Evidence:** [src/components/atoms/\_\_tests\_\_/ErrorBoundary.test.tsx:37](../../src/components/atoms/__tests__/ErrorBoundary.test.tsx#L37)

### F10 — Draft teardown invariant recognizes only two marker strings

**Decision:** Strengthen fixture and final persisted-state assertions.

Submission location/time are never populated; the scanner recognizes only cat-1/photo-1. Submission id/source, location/time, or color-use history can survive while the claimed no-content invariant passes. Seed nondefault draft fields and compare persisted state against legitimate reset defaults. Keep the anti-vacuity and upload-retention checks. A future unimported/unpopulated store cannot automatically be discovered by this test.

**Evidence:** [src/lib/submission/\_\_tests\_\_/draft.invariant.test.ts:47](../../src/lib/submission/__tests__/draft.invariant.test.ts#L47), [src/lib/submission/\_\_tests\_\_/draft.invariant.test.ts:93](../../src/lib/submission/__tests__/draft.invariant.test.ts#L93)

### F11 — Capture contract accepts incorrect positive dimensions

**Decision:** Improve exact dimension assertions.

All accepted backend rows check width/height only >0. A hardcoded 1×1 or swapped dimensions passes while corrupting annotation projection. Assert each output dimension equals its input; include a portrait fixture if useful.

**Evidence:** [src/utils/\_\_tests\_\_/buildSubmissionPhotoFromCapture.contract.test.ts:36](../../src/utils/__tests__/buildSubmissionPhotoFromCapture.contract.test.ts#L36)

### F12 — Resize canvas-bound fixture exercises the other branch

**Decision:** Replace the misleading fixture.

(300,100,2)→200 exercises the photo limit, just like the next case. Removing the canvas Math.min still passes. Use (300,200,2)→300 for the canvas cap and rename the case accurately.

**Evidence:** [src/lib/annotate/\_\_tests\_\_/boxResize.test.ts:44](../../src/lib/annotate/__tests__/boxResize.test.ts#L44)

### F13 — Filesystem class imitation duplicates supplied Expo behavior

**Decision:** Keep useful scenarios; use official in-memory files.

Installed expo-file-system/mocks/FileSystem.ts supports real public File/Paths wrappers, create/delete/exists, and __resetMockFileSystem. A reviewer runtime-verified create→exists→delete using the unmodified project Jest setup. Replace the custom File class with that native mock and assert actual file existence through holds/releases. The earlier testing-documentation File exception was too broad and is corrected in this review.

**Evidence:** [src/lib/camera/\_\_tests\_\_/capturedPhotoFiles.test.ts:16](../../src/lib/camera/__tests__/capturedPhotoFiles.test.ts#L16), [src/hooks/\_\_tests\_\_/useCapturedPhotoWorkflow.test.tsx:7](../../src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx#L7)

### F14 — Abandon Cancel test never exercises Cancel

**Decision:** Improve the existing Cancel scenario.

It only attempts navigation and assumes the offered Cancel has no callback. An added destructive Cancel handler would pass. Find the offered Cancel and invoke it if supplied, or use AlertHost and a real press, then assert state preservation.

**Evidence:** [src/hooks/\_\_tests\_\_/useAbandonCatGuard.test.ts:130](../../src/hooks/__tests__/useAbandonCatGuard.test.ts#L130)

### F15 — Remove-and-never-ask-again asserts spies, not the promised result

**Decision:** Improve with real removal/settings state.

The callback test checks setting/photo calls but omits box removal and never checks persisted setting or a subsequent removal bypass. Removing annotation cleanup specifically from this callback passes. Seed real stores, confirm, inspect surviving photos/annotations/settings, and perform the next removal. Keep unrelated active-flow isolation where useful.

**Evidence:** [src/hooks/\_\_tests\_\_/useAnnotatePass.removeConfirm.test.ts:96](../../src/hooks/__tests__/useAnnotatePass.removeConfirm.test.ts#L96)

### F16 — Cat save suites permit navigation without saving

**Decision:** Keep navigation/unknown-value regressions; improve save outcomes.

addCat/updateCat and active-cat clearing are no-op mocks whose outcomes are never checked. Removing addCat or clearActiveCat from commit passes both files. Use real seeded state and verify saved identity, derived photo ids, and active-id clearing. Exercise warning Cancel and Save anyway with those fixtures.

**Evidence:** [src/hooks/\_\_tests\_\_/useCatSubmit.saveNavigation.test.ts:18](../../src/hooks/__tests__/useCatSubmit.saveNavigation.test.ts#L18), [src/hooks/\_\_tests\_\_/useCatSubmit.unsetFieldsWarning.test.ts:19](../../src/hooks/__tests__/useCatSubmit.unsetFieldsWarning.test.ts#L19)

### F17 — Camera gallery-failure scenario checks before background work is established

**Decision:** Synchronize or consolidate.

Awaiting handleTakePhoto does not await its void flushGallerySaves. The photo count is populated before gallery work, so omitting gallery saving satisfies this case. Await the observed rejected save and assert retained review state, or consolidate that assertion into the existing awaited gallery-failure workflow test.

**Evidence:** [src/hooks/\_\_tests\_\_/useCameraCapture.test.ts:235](../../src/hooks/__tests__/useCameraCapture.test.ts#L235)

### F18 — Submission validation tests never check their promised errors

**Decision:** Improve the existing zero-cat/zero-photo cases.

Only absence of an upload is asserted. A silent return passes despite the test name promising feedback. Assert Submission Incomplete plus the relevant real dialog message and preserved draft/submitting state.

**Evidence:** [\_\_tests\_\_/hooks/useSubmissionSubmit.submitFlow.test.ts:396](../../__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts#L396), [\_\_tests\_\_/hooks/useSubmissionSubmit.submitFlow.test.ts:424](../../__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts#L424)

### F19 — Cat removal checks box count without surviving owner

**Decision:** Strengthen identity assertions.

Exactly one box survives, but it may belong to the removed cat. Assert geometry belongs to OTHER_CAT_ID and none remains for CAT_ID. Retain the real-store fixture and existing cat-list identity check.

**Evidence:** [src/hooks/\_\_tests\_\_/useRemoveCat.test.ts:104](../../src/hooks/__tests__/useRemoveCat.test.ts#L104)

### F20 — Last-photo carousel case omits pass completion

**Decision:** Improve final outcome/delegation assertion.

All model-state assertions check only currentIndex. Removing handleBoxingComplete at last-photo Confirm/Not in Photo passes. Observe completion or the resulting active state/destination while retaining the no-overrun index check.

**Evidence:** [src/hooks/\_\_tests\_\_/useAnnotatePass.carouselNav.model.test.ts:139](../../src/hooks/__tests__/useAnnotatePass.carouselNav.model.test.ts#L139)

### F21 — Functions transaction references lose their ancestry

**Decision:** Improve fake reference identity and assertions.

References retain an id but no collection path, and tx.set destinations use expect.anything. Swapping the per-submission marker and per-user counter writes passes despite breaking counts and retry deduplication. Preserve full paths in the narrow SDK fake and assert each transaction destination; existing business branches should stay.

**Evidence:** [functions/src/\_\_tests\_\_/index.test.ts:194](../../functions/src/__tests__/index.test.ts#L194)

### F22 — Storage collision is denied for two independent reasons

**Decision:** Correct ownership-isolation fixture and stale explanation.

The other owner is seeded at count10, so deleting the ownership check still rejects via the ordinary photo cap. Seed another owner at count0 and assert denial; keep the separate same-owner9/10 boundary checks. The current should-fail-once-268-lands comment contradicts implemented fail-closed ownership behavior.

**Evidence:** [\_\_tests\_\_/rules/storage.test.ts:254](../../__tests__/rules/storage.test.ts#L254)

### F23 — Google sign-out assertion permits a no-op

**Decision:** Replace the weak assertion; keep token tests.

An empty async googleSignOut passes resolves.toBeUndefined. Assert GoogleSignin.signOut is called through the real JS wrapper; a deferred/rejected SDK result can also verify awaiting/error semantics.

**Evidence:** [src/lib/auth/\_\_tests\_\_/GoogleSignIn.test.ts:26](../../src/lib/auth/__tests__/GoogleSignIn.test.ts#L26)

### F24 — Each-box photo mapping has only one possible photo

**Decision:** Improve fixture discrimination.

One box/one map entry cannot distinguish actual photo-id lookup from using the first uploaded path for every box. Use two boxes on different photos and reversed map order, then assert both associations. Keep the other payload/time rules.

**Evidence:** [src/lib/submission/\_\_tests\_\_/payload.test.ts:59](../../src/lib/submission/__tests__/payload.test.ts#L59)

### F25 — 22 redundant cases remain

**Decision:** Remove these cases while retaining their longer journeys and intermediate assertions.

21 model-prefix cases have identical setup/events/assertions to prefixes already checked by a longer path.test journey. One later oversized Storage upload duplicates the earlier same-principal/create/size/MIME scenario. This decision follows the repository explicit subsumed-case policy; it does not imply that ordinary short tests are low value.

**Evidence:** [src/screens/home/\_\_tests\_\_/HomeScreen.gate.model.test.tsx:186](../../src/screens/home/__tests__/HomeScreen.gate.model.test.tsx#L186), [src/screens/home/\_\_tests\_\_/HomeScreen.entrypointActions.model.test.tsx:173](../../src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx#L173), [src/screens/home/\_\_tests\_\_/HomeScreen.photoSourceGate.model.test.tsx:149](../../src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx#L149), [src/screens/consent/\_\_tests\_\_/ConsentScreen.cameraGate.model.test.tsx:191](../../src/screens/consent/__tests__/ConsentScreen.cameraGate.model.test.tsx#L191), [src/screens/consent/\_\_tests\_\_/ConsentScreen.locationGate.model.test.tsx:244](../../src/screens/consent/__tests__/ConsentScreen.locationGate.model.test.tsx#L244), [src/screens/camera/\_\_tests\_\_/CameraScreen.permissionGate.model.test.tsx:148](../../src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx#L148), [src/components/atoms/\_\_tests\_\_/SegmentedControl.selectDeselect.model.test.tsx:73](../../src/components/atoms/__tests__/SegmentedControl.selectDeselect.model.test.tsx#L73), [src/components/organisms/\_\_tests\_\_/InsetCropBubble.collapseFlow.model.test.tsx:130](../../src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx#L130), [src/hooks/\_\_tests\_\_/useCameraCapture.controls.model.test.ts:112](../../src/hooks/__tests__/useCameraCapture.controls.model.test.ts#L112), [src/hooks/\_\_tests\_\_/useAnnotatePass.carouselNav.model.test.ts:129](../../src/hooks/__tests__/useAnnotatePass.carouselNav.model.test.ts#L129), [src/screens/submission/create/\_\_tests\_\_/CreateScreen.autoSkipGate.model.test.tsx:170](../../src/screens/submission/create/__tests__/CreateScreen.autoSkipGate.model.test.tsx#L170), [\_\_tests\_\_/rules/storage.test.ts:342](../../__tests__/rules/storage.test.ts#L342)

### F26 — Remaining copied SDK enums

**Decision:** Resource cleanup; preserve useful behavior cases.

These fixtures still copy library PermissionStatus/Accuracy exports. Prefer actual JavaScript exports and narrow operation/native-class substitutions. The installed media package does require a narrow native class fake; do not infer the entire public enum must be copied. This is lower-priority policy alignment, distinct from a demonstrated application regression.

**Evidence:** [src/lib/permissions/\_\_tests\_\_/gallerySavePermission.test.ts:7](../../src/lib/permissions/__tests__/gallerySavePermission.test.ts#L7), [src/hooks/\_\_tests\_\_/useLibraryPhotoPicker.permissionGate.model.test.ts:21](../../src/hooks/__tests__/useLibraryPhotoPicker.permissionGate.model.test.ts#L21), [src/hooks/\_\_tests\_\_/useCameraCapture.test.ts:83](../../src/hooks/__tests__/useCameraCapture.test.ts#L83), [src/hooks/\_\_tests\_\_/useCameraCapture.controls.model.test.ts:66](../../src/hooks/__tests__/useCameraCapture.controls.model.test.ts#L66)

## Exact redundant-case inventory

| File and first location                                                                                                                                                                 | Cases to remove | Redundancy                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------: | --------------------------------------------------------- |
| [src/screens/home/\_\_tests\_\_/HomeScreen.gate.model.test.tsx:186](../../src/screens/home/__tests__/HomeScreen.gate.model.test.tsx#L186)                                               |               2 | consented signed-out and returning-user standalone states |
| [src/screens/home/\_\_tests\_\_/HomeScreen.entrypointActions.model.test.tsx:173](../../src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx#L173)                     |               2 | no-draft and in-progress mount-only journeys              |
| [src/screens/home/\_\_tests\_\_/HomeScreen.photoSourceGate.model.test.tsx:149](../../src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx#L149)                         |               2 | camera-pick and library-pick prefixes                     |
| [src/screens/consent/\_\_tests\_\_/ConsentScreen.cameraGate.model.test.tsx:191](../../src/screens/consent/__tests__/ConsentScreen.cameraGate.model.test.tsx#L191)                       |               1 | first-time denial standalone journey                      |
| [src/screens/consent/\_\_tests\_\_/ConsentScreen.locationGate.model.test.tsx:244](../../src/screens/consent/__tests__/ConsentScreen.locationGate.model.test.tsx#L244)                   |               1 | first-time denial standalone journey                      |
| [src/screens/camera/\_\_tests\_\_/CameraScreen.permissionGate.model.test.tsx:148](../../src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx#L148)                   |               2 | permission-gate and missing-device mount prefixes         |
| [src/components/atoms/\_\_tests\_\_/SegmentedControl.selectDeselect.model.test.tsx:73](../../src/components/atoms/__tests__/SegmentedControl.selectDeselect.model.test.tsx#L73)         |               1 | deselect prefix                                           |
| [src/components/organisms/\_\_tests\_\_/InsetCropBubble.collapseFlow.model.test.tsx:130](../../src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx#L130)     |               1 | collapse prefix of re-expand journey                      |
| [src/hooks/\_\_tests\_\_/useCameraCapture.controls.model.test.ts:112](../../src/hooks/__tests__/useCameraCapture.controls.model.test.ts#L112)                                           |               5 | three flash prefixes and two flip prefixes                |
| [src/hooks/\_\_tests\_\_/useAnnotatePass.carouselNav.model.test.ts:129](../../src/hooks/__tests__/useAnnotatePass.carouselNav.model.test.ts#L129)                                       |               2 | initial and one-confirm prefixes                          |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.autoSkipGate.model.test.tsx:170](../../src/screens/submission/create/__tests__/CreateScreen.autoSkipGate.model.test.tsx#L170) |               2 | initial and first-cat prefixes                            |
| [\_\_tests\_\_/rules/storage.test.ts:342](../../__tests__/rules/storage.test.ts#L342)                                                                                                   |               1 | later oversized-upload case duplicates line102            |

Keep the complete cycle/deviation journeys and their per-state assertions. Preserve distinct initial-empty versus mounted-nonempty Cat List histories when consolidating auto-skip coverage. Strengthen the retained denial/completion assertions before trimming those prefixes.

## Primary decisions on other reviewer suggestions

- **Keep legitimate boundary mocks.** Native maps, camera APIs, identity providers, Firebase SDKs, and focused screen-to-hook delegation can be isolated. Raw mock counts, test filenames, or a style proxy alone do not demonstrate a bad test. Narrow RN Firebase mocks are consistent with the repository backend guidance.
- **Keep theme restart cases.** The custom persistent Map survives module reload deliberately; the installed MMKV test implementation creates fresh per-instance memory. Replacing the Map mechanically would lose the cold-start test’s intended persistence boundary. Its limitation should be described honestly; it is not evidence that the test is useless.
- **Keep the normal Live-fix start journey.** The proposed replacement adds a redundant-start event and is not an identical event prefix. A simple first start and a second caller while pending are distinct scenarios. Extend successful-fix reacquisition if needed rather than deleting a case solely because the final state matches.
- **Keep cache-sync argument coverage.** It verifies the hook passes current Manual time, which is the regression it targets. A real-cache end-to-end assertion would add confidence, but the existing argument-level test is not inherently invalid.
- **Keep pure calculation and permission tests.** A model is optional; one focused input/output assertion can be load-bearing. The cat-color simulate helper builds inputs for the real selector and does not replace the application logic being asserted.
- **Keep direct drag/termination events.** User Event does not implement these responder interactions; existing press/typing/long-press operations are awaited.
- **Optional simplification:** the add-more-photos and location-warning models mostly enumerate independent input decisions. Table-driven cases may be clearer, but their useful action/disabled assertions should stay.

## Missing scenarios and execution infrastructure

These are follow-ups, not reasons to discard otherwise useful tests:

- Upload queue: reject an active upload, then prove queued work continues and the failed photo is not marked uploaded. The current successful burst remains useful.
- Functions: test the destructive orphan sweep and preservation of existing non-tester custom claims. Group each scenario by the specific deletion/preservation/failure behavior it verifies.
- Firebase adapters: keep initialization/wiring tests; add focused business-operation tests for actual auth forwarding/token/sign-out behavior and upload/finalization/cleanup. The files named emulator are mocked SDK unit tests; their names alone do not establish an integration defect.
- Rules: add the 249/250 submission boundary, changed-size overwrite denial, count ownership access, and denied marker access. Existing tests do not exercise these independent protections.
- **CI gap:** [.github/workflows/ci.yml:52](../../.github/workflows/ci.yml#L52) runs only root npm test; root Jest excludes Functions and rules. Add independent Node/Functions and Java/emulator lanes.
- **Rules-runner portability:** [scripts/run-rules-tests.mjs:30](../../scripts/run-rules-tests.mjs#L30) discovers Windows JDKs only unless RULES_TEST_JAVA_HOME is set. It rejected this Linux environment despite Java21 being available. Honor a usable configured/PATH JDK before platform-specific discovery.

## Validation and limits

- Earlier full current application run: **76 suites / 347 tests passed**; this review changes documentation only.
- Reviewers reran **45 application suites / 207 tests**, all passing: screens 11/56, components/config 10/36, domain/utilities 18/95, auth/upload 6/20.
- The official Expo filesystem resource was separately runtime-probed using real public File/Paths wrappers and the existing Jest preset; create/exists/delete passed.
- Rules tests were statically reviewed but not executed: the runner refused non-Windows Java discovery. Functions tests were statically reviewed but not executed: nested dependencies are not installed. Those three files contain 43 cases in total.
- Findings are source-backed review decisions, not a claim that every proposed mutation was executed. The earlier two mutation probes remain documented in the implementation note.

## Complete file inventory

“Keep” means no material issue found in the scoped review, not a proof of complete behavioral coverage. Reference IDs identify accepted improvement/removal findings; backend coverage follow-ups remain separate.

### Screens: gates and entrypoints

11 files reviewed.

| Test file                                                                                                                                                    | Primary disposition           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| [src/screens/analytics-consent/\_\_tests\_\_/AnalyticsConsentScreen.test.tsx](../../src/screens/analytics-consent/__tests__/AnalyticsConsentScreen.test.tsx) | Keep; no material finding     |
| [src/screens/camera/\_\_tests\_\_/CameraScreen.permissionGate.model.test.tsx](../../src/screens/camera/__tests__/CameraScreen.permissionGate.model.test.tsx) | Improve/consolidate: F25      |
| [src/screens/consent/\_\_tests\_\_/ConsentScreen.cameraGate.model.test.tsx](../../src/screens/consent/__tests__/ConsentScreen.cameraGate.model.test.tsx)     | Improve/consolidate: F05, F25 |
| [src/screens/consent/\_\_tests\_\_/ConsentScreen.locationGate.model.test.tsx](../../src/screens/consent/__tests__/ConsentScreen.locationGate.model.test.tsx) | Improve/consolidate: F25      |
| [src/screens/consent/\_\_tests\_\_/ConsentScreen.test.tsx](../../src/screens/consent/__tests__/ConsentScreen.test.tsx)                                       | Improve/consolidate: F05      |
| [src/screens/home/\_\_tests\_\_/HomeScreen.entrypointActions.model.test.tsx](../../src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx)   | Improve/consolidate: F03, F25 |
| [src/screens/home/\_\_tests\_\_/HomeScreen.gate.model.test.tsx](../../src/screens/home/__tests__/HomeScreen.gate.model.test.tsx)                             | Improve/consolidate: F25      |
| [src/screens/home/\_\_tests\_\_/HomeScreen.photoSourceGate.model.test.tsx](../../src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx)       | Improve/consolidate: F04, F25 |
| [src/screens/home/\_\_tests\_\_/HomeScreen.resumeEntry.test.tsx](../../src/screens/home/__tests__/HomeScreen.resumeEntry.test.tsx)                           | Keep; no material finding     |
| [src/screens/intro-flow/\_\_tests\_\_/IntroFlowScreen.test.tsx](../../src/screens/intro-flow/__tests__/IntroFlowScreen.test.tsx)                             | Improve/consolidate: F06      |
| [src/screens/sign-in/\_\_tests\_\_/SignInScreen.test.tsx](../../src/screens/sign-in/__tests__/SignInScreen.test.tsx)                                         | Keep; no material finding     |

### Submission screens

11 files reviewed.

| Test file                                                                                                                                                                                    | Primary disposition       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [src/screens/submission/annotate/\_\_tests\_\_/AnnotateScreen.buttons.test.tsx](../../src/screens/submission/annotate/__tests__/AnnotateScreen.buttons.test.tsx)                             | Keep; no material finding |
| [src/screens/submission/cats/\_\_tests\_\_/CatObservationScreen.insetCropHeaderZone.test.tsx](../../src/screens/submission/cats/__tests__/CatObservationScreen.insetCropHeaderZone.test.tsx) | Keep; no material finding |
| [src/screens/submission/cats/\_\_tests\_\_/attributes.test.ts](../../src/screens/submission/cats/__tests__/attributes.test.ts)                                                               | Keep; no material finding |
| [src/screens/submission/cats/\_\_tests\_\_/summarizeCat.test.ts](../../src/screens/submission/cats/__tests__/summarizeCat.test.ts)                                                           | Keep; no material finding |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.addMorePhotosAction.model.test.tsx](../../src/screens/submission/create/__tests__/CreateScreen.addMorePhotosAction.model.test.tsx) | Keep; no material finding |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.autoSkipGate.model.test.tsx](../../src/screens/submission/create/__tests__/CreateScreen.autoSkipGate.model.test.tsx)               | Improve/consolidate: F25  |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.backPrompt.model.test.tsx](../../src/screens/submission/create/__tests__/CreateScreen.backPrompt.model.test.tsx)                   | Keep; no material finding |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.catListActions.test.tsx](../../src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx)                       | Improve/consolidate: F02  |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.locationCommit.test.tsx](../../src/screens/submission/create/__tests__/CreateScreen.locationCommit.test.tsx)                       | Keep; no material finding |
| [src/screens/submission/create/\_\_tests\_\_/CreateScreen.locationWarningIcon.model.test.tsx](../../src/screens/submission/create/__tests__/CreateScreen.locationWarningIcon.model.test.tsx) | Keep; no material finding |
| [src/screens/submission/location-picker/\_\_tests\_\_/LocationPicker.model.test.tsx](../../src/screens/submission/location-picker/__tests__/LocationPicker.model.test.tsx)                   | Improve/consolidate: F01  |

### Hooks

20 files reviewed.

| Test file                                                                                                                                                  | Primary disposition           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| [\_\_tests\_\_/hooks/useSubmissionSubmit.submitFlow.test.ts](../../__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts)                                 | Improve/consolidate: F18      |
| [src/hooks/\_\_tests\_\_/useAbandonCatGuard.test.ts](../../src/hooks/__tests__/useAbandonCatGuard.test.ts)                                                 | Improve/consolidate: F14      |
| [src/hooks/\_\_tests\_\_/useActiveCatFlow.model.test.ts](../../src/hooks/__tests__/useActiveCatFlow.model.test.ts)                                         | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useAnnotatePass.carouselNav.model.test.ts](../../src/hooks/__tests__/useAnnotatePass.carouselNav.model.test.ts)                   | Improve/consolidate: F20, F25 |
| [src/hooks/\_\_tests\_\_/useAnnotatePass.removeConfirm.test.ts](../../src/hooks/__tests__/useAnnotatePass.removeConfirm.test.ts)                           | Improve/consolidate: F15      |
| [src/hooks/\_\_tests\_\_/useBoundingBoxStore.catColors.test.ts](../../src/hooks/__tests__/useBoundingBoxStore.catColors.test.ts)                           | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useBoundingBoxStore.test.ts](../../src/hooks/__tests__/useBoundingBoxStore.test.ts)                                               | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useCameraCapture.controls.model.test.ts](../../src/hooks/__tests__/useCameraCapture.controls.model.test.ts)                       | Improve/consolidate: F25, F26 |
| [src/hooks/\_\_tests\_\_/useCameraCapture.test.ts](../../src/hooks/__tests__/useCameraCapture.test.ts)                                                     | Improve/consolidate: F17, F26 |
| [src/hooks/\_\_tests\_\_/useCapturedPhotoWorkflow.test.tsx](../../src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx)                                   | Improve/consolidate: F13      |
| [src/hooks/\_\_tests\_\_/useCatForm.initialSelection.test.ts](../../src/hooks/__tests__/useCatForm.initialSelection.test.ts)                               | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useCatSubmit.saveNavigation.test.ts](../../src/hooks/__tests__/useCatSubmit.saveNavigation.test.ts)                               | Improve/consolidate: F16      |
| [src/hooks/\_\_tests\_\_/useCatSubmit.unsetFieldsWarning.test.ts](../../src/hooks/__tests__/useCatSubmit.unsetFieldsWarning.test.ts)                       | Improve/consolidate: F16      |
| [src/hooks/\_\_tests\_\_/useLibraryPhotoPicker.permissionGate.model.test.ts](../../src/hooks/__tests__/useLibraryPhotoPicker.permissionGate.model.test.ts) | Improve/consolidate: F26      |
| [src/hooks/\_\_tests\_\_/useNativeCameraCapture.focus.test.ts](../../src/hooks/__tests__/useNativeCameraCapture.focus.test.ts)                             | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/usePhotoStore.source.test.ts](../../src/hooks/__tests__/usePhotoStore.source.test.ts)                                             | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useRemoveCat.test.ts](../../src/hooks/__tests__/useRemoveCat.test.ts)                                                             | Improve/consolidate: F19      |
| [src/hooks/\_\_tests\_\_/useSettingsStore.nativeDefault.test.ts](../../src/hooks/__tests__/useSettingsStore.nativeDefault.test.ts)                         | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useSubmissionSubmit.cacheSync.test.ts](../../src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts)                           | Keep; no material finding     |
| [src/hooks/\_\_tests\_\_/useSubmissionSubmit.reset.test.ts](../../src/hooks/__tests__/useSubmissionSubmit.reset.test.ts)                                   | Keep; no material finding     |

### Components and configuration

10 files reviewed.

| Test file                                                                                                                                                                  | Primary disposition                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [\_\_tests\_\_/components/atoms/StatusIcon.test.tsx](../../__tests__/components/atoms/StatusIcon.test.tsx)                                                                 | Keep; no material finding          |
| [src/components/atoms/\_\_tests\_\_/AppButton.test.tsx](../../src/components/atoms/__tests__/AppButton.test.tsx)                                                           | Keep; no material finding          |
| [src/components/atoms/\_\_tests\_\_/ErrorBoundary.test.tsx](../../src/components/atoms/__tests__/ErrorBoundary.test.tsx)                                                   | Improve/consolidate: F09           |
| [src/components/atoms/\_\_tests\_\_/SegmentedControl.selectDeselect.model.test.tsx](../../src/components/atoms/__tests__/SegmentedControl.selectDeselect.model.test.tsx)   | Improve/consolidate: F25           |
| [src/components/organisms/\_\_tests\_\_/AlertHost.test.tsx](../../src/components/organisms/__tests__/AlertHost.test.tsx)                                                   | Keep; no material finding          |
| [src/components/organisms/\_\_tests\_\_/InsetCropBubble.collapseFlow.model.test.tsx](../../src/components/organisms/__tests__/InsetCropBubble.collapseFlow.model.test.tsx) | Improve/consolidate: F07, F08, F25 |
| [src/components/organisms/\_\_tests\_\_/InsetCropBubble.diameterDerivation.test.tsx](../../src/components/organisms/__tests__/InsetCropBubble.diameterDerivation.test.tsx) | Improve/consolidate: F08           |
| [src/components/organisms/\_\_tests\_\_/InsetCropBubble.dock.test.tsx](../../src/components/organisms/__tests__/InsetCropBubble.dock.test.tsx)                             | Improve/consolidate: F08           |
| [src/components/organisms/\_\_tests\_\_/InsetCropBubble.drag.test.tsx](../../src/components/organisms/__tests__/InsetCropBubble.drag.test.tsx)                             | Improve/consolidate: F08           |
| [src/config/\_\_tests\_\_/themeMode.test.ts](../../src/config/__tests__/themeMode.test.ts)                                                                                 | Keep; no material finding          |

### Domain and utility logic

18 files reviewed.

| Test file                                                                                                                                              | Primary disposition       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| [src/lib/\_\_tests\_\_/location.model.test.ts](../../src/lib/__tests__/location.model.test.ts)                                                         | Keep; no material finding |
| [src/lib/\_\_tests\_\_/location.test.ts](../../src/lib/__tests__/location.test.ts)                                                                     | Keep; no material finding |
| [src/lib/annotate/\_\_tests\_\_/boxResize.test.ts](../../src/lib/annotate/__tests__/boxResize.test.ts)                                                 | Improve/consolidate: F12  |
| [src/lib/annotate/\_\_tests\_\_/catColors.test.ts](../../src/lib/annotate/__tests__/catColors.test.ts)                                                 | Keep; no material finding |
| [src/lib/annotate/\_\_tests\_\_/cropProjection.test.ts](../../src/lib/annotate/__tests__/cropProjection.test.ts)                                       | Keep; no material finding |
| [src/lib/annotate/\_\_tests\_\_/panClamp.test.ts](../../src/lib/annotate/__tests__/panClamp.test.ts)                                                   | Keep; no material finding |
| [src/lib/camera/\_\_tests\_\_/capturedPhotoFiles.test.ts](../../src/lib/camera/__tests__/capturedPhotoFiles.test.ts)                                   | Improve/consolidate: F13  |
| [src/lib/home/\_\_tests\_\_/entrypointDiameter.test.ts](../../src/lib/home/__tests__/entrypointDiameter.test.ts)                                       | Keep; no material finding |
| [src/lib/insetCrop/\_\_tests\_\_/collapse.test.ts](../../src/lib/insetCrop/__tests__/collapse.test.ts)                                                 | Keep; no material finding |
| [src/lib/insetCrop/\_\_tests\_\_/diameter.test.ts](../../src/lib/insetCrop/__tests__/diameter.test.ts)                                                 | Keep; no material finding |
| [src/lib/permissions/\_\_tests\_\_/cameraPermission.test.ts](../../src/lib/permissions/__tests__/cameraPermission.test.ts)                             | Keep; no material finding |
| [src/lib/permissions/\_\_tests\_\_/gallerySavePermission.test.ts](../../src/lib/permissions/__tests__/gallerySavePermission.test.ts)                   | Improve/consolidate: F26  |
| [src/lib/permissions/\_\_tests\_\_/libraryPermission.test.ts](../../src/lib/permissions/__tests__/libraryPermission.test.ts)                           | Keep; no material finding |
| [src/lib/permissions/\_\_tests\_\_/locationPermission.test.ts](../../src/lib/permissions/__tests__/locationPermission.test.ts)                         | Keep; no material finding |
| [src/lib/submission/\_\_tests\_\_/draft.invariant.test.ts](../../src/lib/submission/__tests__/draft.invariant.test.ts)                                 | Improve/consolidate: F10  |
| [src/lib/submission/\_\_tests\_\_/payload.test.ts](../../src/lib/submission/__tests__/payload.test.ts)                                                 | Improve/consolidate: F24  |
| [src/utils/\_\_tests\_\_/buildSubmissionPhotoFromCapture.contract.test.ts](../../src/utils/__tests__/buildSubmissionPhotoFromCapture.contract.test.ts) | Improve/consolidate: F11  |
| [src/utils/\_\_tests\_\_/libraryPickTime.test.ts](../../src/utils/__tests__/libraryPickTime.test.ts)                                                   | Keep; no material finding |

### Authentication, uploads, rules, Functions

9 files reviewed.

| Test file                                                                                                                              | Primary disposition                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [\_\_tests\_\_/rules/firestore.test.ts](../../__tests__/rules/firestore.test.ts)                                                       | Keep; see independent coverage follow-ups |
| [\_\_tests\_\_/rules/storage.test.ts](../../__tests__/rules/storage.test.ts)                                                           | Improve/consolidate: F22, F25             |
| [functions/src/\_\_tests\_\_/index.test.ts](../../functions/src/__tests__/index.test.ts)                                               | Improve/consolidate: F21                  |
| [src/lib/auth/\_\_tests\_\_/GoogleSignIn.test.ts](../../src/lib/auth/__tests__/GoogleSignIn.test.ts)                                   | Improve/consolidate: F23                  |
| [src/lib/auth/\_\_tests\_\_/authProvider.test.ts](../../src/lib/auth/__tests__/authProvider.test.ts)                                   | Keep; see independent coverage follow-ups |
| [src/lib/auth/\_\_tests\_\_/authProviders.test.ts](../../src/lib/auth/__tests__/authProviders.test.ts)                                 | Keep; see independent coverage follow-ups |
| [src/lib/auth/\_\_tests\_\_/firebaseAuthProvider.emulator.test.ts](../../src/lib/auth/__tests__/firebaseAuthProvider.emulator.test.ts) | Keep; see independent coverage follow-ups |
| [src/lib/upload/\_\_tests\_\_/firebaseUpload.emulator.test.ts](../../src/lib/upload/__tests__/firebaseUpload.emulator.test.ts)         | Keep; see independent coverage follow-ups |
| [src/lib/upload/\_\_tests\_\_/uploadNewPhoto.queue.test.ts](../../src/lib/upload/__tests__/uploadNewPhoto.queue.test.ts)               | Keep; see independent coverage follow-ups |
