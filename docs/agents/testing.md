# Testing policy

Authoritative rules for how tests are written in this repo. Agents follow this by default; a human may override per-request.

## Default: load-bearing tests only

Write a test only when it would **catch a failure likely to actually occur** — if you can't name that failure, don't write it. Never write a test to demonstrate that code was tested. (Relaxed from "model-based and stateful-flow tests only", 2026-08-24, #292.)

### Choosing a test

- For a bug fix, first write a test that fails on the reported bug, then fix it. A reported bug is the clearest "failure likely to occur."
- Prefer the shape that fits the logic: a state machine for a stateful flow, a plain case for a pure decision on inputs, an invariant asserted against real persisted state for a "nothing must survive this" rule (`src/features/draft-submission/lib/__tests__/draft.invariant.test.ts`).
- Prefer an invariant read from the real thing over an assertion against a hand-maintained list — the list is the part that goes stale, and a test that has to be remembered doesn't catch the case where it was forgotten.
- Do not default to hand-written, per-case `it()` assertion tests. They repeat setup, assert one shallow thing each, miss transition coverage, and accumulate as bloat.
- Avoid source-text/regex tests that claim to verify rendering: render the relevant control and inspect its behavior or resolved style instead.

### Deleting tests

- When a model test or journey asserts the same states, delete the hand-written cases it subsumes. Example: `src/core/home/screens/home/__tests__/HomeScreen.test.tsx` (4 hand cases) was fully covered by the gate model and removed.
- Delete a test when the branch it covers becomes unreachable — an unreachable branch's test passes forever and proves nothing.

## Model-based tests

### When to build the model

Create the machine model **when the design is established — just prior to or at the beginning of implementation.** Model-first, not test-after: design → model → implement against it. The model is a design artifact, not a post-hoc coverage exercise.

### Tooling

- `xstate` (`createMachine`) for the model; `@xstate/graph` (`createTestModel`) to drive tests.
- Canonical in-repo example: `src/core/home/screens/home/__tests__/HomeScreen.gate.model.test.tsx` — a `gateMachine` plus `testParams` (`states` + `events`).

### Pick the path generator by intent

Choose from `@xstate/graph` `TestModel`:

- `getPathsFromEvents([...events])` — **UX-flow tool.** Author the real journey as an explicit event sequence (happy path plus key deviations); the model validates each step.
- `getSimplePaths()` — every distinct non-repeating journey; breadth of paths a user could take.
- `getShortestPaths()` — one minimal path per reachable state: a structural reachability guard, **not** a user journey.

### Model the real experience

- Model the machine with the **real user events** — including back, cancel, sign-out, retry — not just the forward happy-path transitions.
- Assert **what the user sees at each step**, not only a redirect or a single side effect.

## Mocks and boundaries

### What stays real

Keep application stores, controls, and JavaScript wrappers real when their behavior is under test. Isolating a separately tested hook is appropriate for a focused screen-wiring check. Substitute native or external services at their boundary, and configure only the outcomes a test needs.

### Use the libraries' testing resources

Use the resources shipped with the installed version. Never hand-roll a mock, stub, or proxy for a library that ships its own test resource.

| Library               | Resource used by this suite                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo                  | [`jest-expo` and native module mocks](https://docs.expo.dev/modules/mocking/). Preserve real JS exports with `jest.requireActual` when overriding an operation.                                                                                                                       |
| Unistyles             | `react-native-unistyles/mocks`, configured with `src/shared/config/themes.ts` in `jest.setup.js`. Nonzero runtime insets exercise safe-area styles.                                                                                                                                   |
| Expo FileSystem       | `expo-file-system/mocks/FileSystem` supplies in-memory native file behavior through `jest-expo`. Use real public `File`/`Paths`, create fixture files, inspect `exists`, and reset with `__resetMockFileSystem`.                                                                      |
| MMKV 4                | `createMMKV` automatically selects its supplied in-memory implementation under Jest. No application stub is needed.                                                                                                                                                                   |
| AsyncStorage          | [`@react-native-async-storage/async-storage/jest/async-storage-mock`](https://react-native-async-storage.github.io/async-storage/docs/advanced/jest/), installed once in `jest.setup.js` and cleared between tests.                                                                   |
| Reanimated / Worklets | [`react-native-reanimated/mock`](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/). The installed Worklets 0.8 package supplies `react-native-worklets/jest/resolver` for resolving its test implementation. Check installed paths when consulting newer docs. |
| Google Sign-In        | The package's `jest/build/jest/setup.js`, already registered in `jest.config.js`.                                                                                                                                                                                                     |
| Firebase rules        | [`@firebase/rules-unit-testing`](https://firebase.google.com/docs/rules/unit-tests), already used by `__tests__/rules/`; run through `npm run test:rules` with local emulators.                                                                                                       |
| Zustand               | [Zustand's Jest recipe](https://zustand.docs.pmnd.rs/guides/testing) in `__mocks__/zustand.ts`; `jest.setup.js` resets every store to initial state after each test. Seed state in `beforeEach`.                                                                                      |

### When a narrow fake is justified

Use a narrow adapter fake only when no supplied mock can represent the boundary being tested; it must not reproduce application store logic. State the limitation instead of discarding that regression scenario. Examples:

- The media-library Asset boundary has no usable supplied mock.
- The installed MMKV test implementation gives each new instance fresh memory; a cold-start configuration test needs a fixture that preserves stored values across module reloads.

### Native code is out of Jest's reach

A Jest test that mocks a native module proves nothing about the Kotlin or Swift behind it. Verify native changes with a compile and a device drive ([native-code.md](native-code.md)); don't cite a passing Jest run as evidence for them.

## Writing interactions and assertions

### User events

Use React Native Testing Library's [User Event API](https://callstack.github.io/react-native-testing-library/docs/api/events/user-event) for presses, long presses, and typing, and await each interaction.

- `userEvent.setup()` can share an interaction session; use fake timers for animation timing tests.
- Do not wrap user events in another `act`.
- Direct responder events remain appropriate for drag/termination behavior that User Event does not simulate.

### Dialogs

Press app dialog buttons with `pressDialogButton(text)` from `src/test-utils/dialog.ts`: it runs AlertHost's own press path (`useUIStore`'s `pressDialogButton`: dismiss, then handler) and awaits the handler. Don't read `showAlert` mock calls or stub `showAlert` to auto-press.

### Async outcomes

Await asynchronous dialog callbacks themselves. A fixed number of `Promise.resolve()` calls, or an assertion that an operation merely started, does not establish that its success/failure handling finished.

- Assert the resulting UI or persisted state.
- Do not suppress unrelated exceptions to make a test pass.

## Suite setup: config, fixtures, type checking

### File naming and placement

Put tests in a `__tests__/` folder beside the code. Root `__tests__/` holds only app-wide tests (`RootLayout`) and Firebase rules tests (`__tests__/rules/`). Name the file by test kind:

- `*.model.test.ts(x)` — XState model tests.
- `*.invariant.test.ts` — invariants against real persisted state.
- `*.emulator.test.ts` — tests against local Firebase emulators.
- `*.test.ts(x)` — everything else.

### Jest config

`jest.config.js` sets `clearMocks` and `restoreMocks`: don't repeat `clearAllMocks`/`restoreAllMocks` per file.

### Shared fixtures

Shared fixtures live in `src/test-utils/`: `observedCat`, `submissionPhoto`, `setConsent` (real consent store). Prefer the factories: one place to add a new required field.

### Type checking

Tests type-check through `tsconfig.test.json` (part of `npm run typecheck`), rules tests included. Jest runs TypeScript through Babel, which only strips types; [Jest's docs](https://jestjs.io/docs/getting-started#using-typescript) say to run `tsc` separately for type checking.

- A seeded store field or fake hook result that no longer exists fails there.
- Type fakes against the real return type, e.g. `ReturnType<typeof useX>`.
