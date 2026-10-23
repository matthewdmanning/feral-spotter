# Testing policy

Authoritative rules for how tests are written in this repo. Agents follow this by default; a human may override per-request.

## Default: load-bearing tests only

Write a test when it would **catch a failure likely to actually occur**. Never write a test to demonstrate that code was tested.

The rule this replaces was "model-based and stateful-flow tests only." That existed to stop slop tests, not to mandate state machines, and it was over-read: it pushed work toward building a machine for logic that has no states, and it discouraged the one check a change genuinely needed when that check wasn't a machine. Relaxed 2026-08-24 (#292) to what it was always trying to say.

- A test earns its place by the failure it would catch. If you can't name that failure, don't write it.
- Prefer the shape that fits the logic: a state machine for a stateful flow, a plain case for a pure decision on inputs, an invariant asserted against real persisted state for a "nothing must survive this" rule (`src/lib/submission/__tests__/draft.invariant.test.ts`).
- Prefer an invariant read from the real thing over an assertion against a hand-maintained list — the list is the part that goes stale, and a test that has to be remembered doesn't catch the case where it was forgotten.
- Do not default to hand-written, per-case `it()` assertion tests. They repeat setup, assert one shallow thing each, miss transition coverage, and accumulate as bloat.
- When a model test covers a flow, delete the hand-written tests it subsumes. Example: `src/screens/home/__tests__/HomeScreen.test.tsx` (4 hand cases) was fully covered by the gate model and removed.
- Delete a test when the branch it covers becomes unreachable — an unreachable branch's test passes forever and proves nothing.

## When to build the model

Create the machine model **when the design is established — just prior to or at the beginning of implementation.** Model-first, not test-after: design → model → implement against it. The model is a design artifact, not a post-hoc coverage exercise.

## Tooling

- `xstate` (`createMachine`) for the model; `@xstate/graph` (`createTestModel`) to drive tests.
- Canonical in-repo example: `src/screens/home/__tests__/HomeScreen.gate.model.test.tsx` — a `gateMachine` plus `testParams` (`states` + `events`). Note: it currently uses `getShortestPaths` (coverage only); upgrade toward journey tests per below.

## getShortestPaths is coverage, not user experience

`getShortestPaths()` walks one minimal path to each reachable state. It proves reachability and correct per-state behavior — it is **not** a user journey. It won't walk the happy path end-to-end, won't exercise back / cancel / sign-out / retry, won't repeat steps a real user takes.

Pick the path generator by intent (`@xstate/graph` `TestModel`):

- `getPathsFromEvents([...events])` — **UX-flow tool.** Author the real journey as an explicit event sequence (happy path plus key deviations); the model validates each step. Use this for user-experience flows.
- `getSimplePaths()` — every distinct non-repeating journey; breadth of paths a user could take.
- `getShortestPaths()` — structural reachability guard only.

## Model the real experience

- Model the machine with the **real user events** — including back, cancel, sign-out, retry — not just the forward happy-path transitions.
- Assert **what the user sees at each step**, not only a redirect or a single side effect.

## Use the libraries' testing resources

Keep application stores, controls, and JavaScript wrappers real when their
behavior is under test. Isolating a separately tested hook is appropriate for a
focused screen-wiring check. Substitute native or external services at their
boundary, and configure only the outcomes a test needs. Prefer the resources shipped with the installed version:

| Library               | Resource used by this suite                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo                  | [`jest-expo` and native module mocks](https://docs.expo.dev/modules/mocking/). Preserve real JS exports with `jest.requireActual` when overriding an operation; don't copy enums into a partial module.                                                                               |
| Unistyles             | `react-native-unistyles/mocks`, configured with `src/config/themes.ts` in `jest.setup.js`. Never use a proxy that accepts arbitrary theme tokens. Nonzero runtime insets exercise safe-area styles.                                                                                   |
| Expo FileSystem       | `expo-file-system/mocks/FileSystem` supplies in-memory native file behavior through `jest-expo`. Use real public `File`/`Paths`, create fixture files, inspect `exists`, and reset with `__resetMockFileSystem`.                                                                      |
| MMKV 4                | `createMMKV` automatically selects its supplied in-memory implementation under Jest. No application stub is needed.                                                                                                                                                                   |
| AsyncStorage          | [`@react-native-async-storage/async-storage/jest/async-storage-mock`](https://react-native-async-storage.github.io/async-storage/docs/advanced/jest/), installed once in `jest.setup.js` and cleared between tests.                                                                   |
| Reanimated / Worklets | [`react-native-reanimated/mock`](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/). The installed Worklets 0.8 package supplies `react-native-worklets/jest/resolver` for resolving its test implementation. Check installed paths when consulting newer docs. |
| Google Sign-In        | The package's `jest/build/jest/setup.js`, already registered in `jest.config.js`.                                                                                                                                                                                                     |
| Firebase rules        | [`@firebase/rules-unit-testing`](https://firebase.google.com/docs/rules/unit-tests), already used by `__tests__/rules/`; run through `npm run test:rules` with local emulators.                                                                                                       |

Use React Native Testing Library's [User Event API](https://callstack.github.io/react-native-testing-library/docs/api/events/user-event)
for presses, long presses, and typing, and await each interaction. `userEvent.setup()`
can share an interaction session; use fake timers for animation timing tests.
Do not wrap user events in another `act`. Direct responder events remain appropriate
for drag/termination behavior that User Event does not simulate.

Await asynchronous dialog callbacks themselves. A fixed number of
`Promise.resolve()` calls, or an assertion that an operation merely started, does
not establish that its success/failure handling finished. Assert the resulting
UI or persisted state. Do not suppress unrelated exceptions to make a test pass.

Delete cases subsumed by a journey that asserts the same intermediate state.
Avoid source-text/regex tests that claim to verify rendering: render the relevant
control and inspect its behavior or resolved style instead. Native class adapters
without usable supplied mocks may still need narrow fakes (for example the current
media-library Asset boundary); these must not reproduce application store logic.
The installed Expo FileSystem package has a usable in-memory mock, so its public
File wrapper does not need a replacement class.

If a supplied mock cannot represent the boundary being tested, a narrow adapter
fake may be justified. For example, the installed MMKV test implementation gives
each new instance fresh memory; a cold-start configuration test needs a fixture
that preserves stored values across module reloads. State the limitation instead
of discarding that regression scenario.
