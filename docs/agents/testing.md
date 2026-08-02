# Testing policy

Authoritative rules for how tests are written in this repo. Agents follow this by default; a human may override per-request.

## Default: model-based + stateful-flow tests only

Write **only** business logic unit tests, state-machine models, stateful-flow checks as tests — **unless the request explicitly asks for something else** (e.g. a regression repro). The unit tests must be load-bearing.

- Do not default to hand-written, per-case `it()` assertion tests. They repeat setup, assert one shallow thing each, miss transition coverage, and accumulate as bloat.
- When a model test covers a flow, delete the hand-written tests it subsumes. Example: `src/screens/home/__tests__/HomeScreen.test.tsx` (4 hand cases) was fully covered by the gate model and removed.

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
