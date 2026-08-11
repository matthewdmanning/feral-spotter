# Summary: commit/PR activity since creation, 18 flagged issues (#63-159 audit)

Raw dump: `docs/scratchpad/issue-activity-dump-2026-08-06.md` (not read directly — Explore agent summarized it).

- `#63` setState-on-unmounted Register->Consent: fix landed 7f4c2a4 ("Closes #63") 2026-07-24, but e26cd47 (2026-07-25) logs #63 still open post register->profile rename. Possibly recurred.
- `#66` camera consent selection treated as denial: 10e544b (2026-07-26) fixes concurrent `Promise.all` permission dialogs matching #66's symptom exactly — closed under **#67**, never cross-ref'd to #66.
- `#70` copy for precise-location ask: NOTHING FOUND.
- `#76` Beta: verify photo timestamps: NOTHING FOUND — only related work (337c7d8) covers library-picked photos, not camera-captured.
- `#87` connect w/ rescue groups: NOTHING FOUND.
- `#92` Profile/Register transition slow: docs only, e6057b5 logs reproduction, no fix.
- `#95` GPS mocking inconsistent: NOTHING FOUND since creation (nearest work predates issue by 2 days).
- `#98` hardware-back crash on intro first slide: docs only, e241446 (FSM audit) surfaced it, no fix.
- `#101` unhandled exception in permission chain: same e241446 doc surfaced it, no fix since.
- `#102` native map picker: **done** — 5765dee "Closes #47, Closes #102" implemented. Gap is wayfinder-map paperwork only.
- `#121` Camera test-drive UI fixes (umbrella): **done** — PR #136 implements it, closes children #122/#105/#104/#123/#94/#91, never says "Closes #121" itself.
- `#124` Cat Observations cleanup (umbrella): **done, twice** — PR #131 "Closes #116, #124, #125, #126", then 532e3c6 closes #124 again. Missing piece is wayfinder cross-ref only.
- `#127` Location capture follow-ups: partial — same 2026-07-31 work (PR #132) landed but #127 itself never referenced by number.
- `#128` GPS-on-open + staleness flag: **done** — PR #132 "Closes #97, #128, #130" matches title exactly.
- `#129` address-remember-for-later: **moot, not addressed as asked** — PR #132 removed the address free-text field entirely; no remember-for-later flow built.
- `#133` per-photo EXIF clustering: **addressed opposite of ask** — PR #136 forces one shared location/time value across picks, not per-photo clustering.
- `#140` shutter opens library picker: **done** — PR #166 fixed via write-only gallery access, closed under #145/#146/#147, never references #140.
- `#141` remove "Continue Without Access" button: docs only — 3c21d95 records the decision, no visible code diff removing the button in this window.

## Read as: which of the 15 "untriaged" opens are actually stale vs. quietly done

| #                                    | Verdict                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| 63, 70, 76, 87, 92, 95, 98, 101, 141 | genuinely untouched or docs-only — real backlog                                       |
| 66, 140                              | code fix landed under a **different** issue number, this one never closed/cross-ref'd |
| 127, 129, 133                        | related work landed but doesn't satisfy this issue's actual ask                       |
| 128                                  | fully done, just needs the label/close                                                |

Plus the wayfinder-task closures (#102, #121, #124): all three have real merged fixes — the only gap is the missing Decisions-so-far pointer on map #31.

## Actions taken (2026-08-06, per advisor plan)

- **#128** closed manually — PR #132 said "Closes #97, #128, #130" (merged main, commit d060899); #97/#130 auto-closed, #128 didn't (no close/reopen event in its timeline — cause unclear, not a base-branch issue since base was `main`). Comment cites PR #132 + d060899.
- **#140** closed as superseded — its own 2026-08-03 comment cross-links it to #145/#146 (same camera-permission root cause, fixed via PR #166 / a23a575 / 023c550, both already closed under parent #144). Not "the same fix," a duplicate re-filing.
- **#66 NOT closed** — advisor caught this before I acted. 10e544b (2026-07-26) fixed the original symptom, but comments show it was reopened live 2026-08-02: "Approximate" location grants COARSE not FINE, tripping the same blocked-gate as a real denial. Matthew recorded a new explicit requirement same day (partial grants proceed, real denial routes to Home not the blocked-gate screen). Root cause + fix now known — candidate for `ready-for-agent`, not stale, not closable.
- Map **#31** got one additive Decisions-so-far entry closing out audit finding B for #102/#121/#124/#128 together.

## Requirements-shift check on remaining open/untouched issues

Read `--comments` on all 11 previously-unchecked issues (63, 66, 70, 76, 87, 92, 95, 98, 127, 140, 141) plus a repo-wide topical grep (not just `#NN`) across `docs/`.

**1. Decision/scope shift recorded — correctly not stale:**

- `#129`, `#133` — Beta-milestone decisions (map #31 Decisions-so-far; ADR 0002:77).
- `#87` — "Connect users with rescue groups": `docs/design/2026-07-25-session-handoff.md:94` — filed explicitly as "feature idea surfaced during the design discussion, not implemented, deferred." Deliberate backlog, not neglect.
- `#66`, `#101` — active/evolving, see above; `docs/design/2026-08-02-ui-bug-punchlist.md:24` and `2026-08-03-punchlist-triage-sprints.md:24` both flag the media-consent overlap explicitly.
- `#63` — comment confirms the bug moved (register.tsx -> profile/index.tsx) and was explicitly left out of #86's scope on purpose, ref updated so it isn't dangling. Recorded, not neglected.

**2. Milestone-parked by title, no code needed yet:**

- `#76` — "Beta release: verify photos have timestamps" self-scopes to Beta.

**3. Genuinely untriaged — no decision found anywhere, real backlog:**

- `#70`, `#92`, `#95`, `#98`, `#127`, `#141`. Note `#98` traces to `docs/design/2026-07-27-onboarding-registration-consent-fsm.md:119` — an open TODO ("worth a quick check") that was never followed up, not a scope call. `#141` is already implicitly agreed (referenced as settled in the #66 2026-08-02 comment: "which is being removed per #141 anyway") — just never labeled/closed.

No label changes made to the category-3 list this pass — flagged here for a follow-up triage decision, not auto-applied.
