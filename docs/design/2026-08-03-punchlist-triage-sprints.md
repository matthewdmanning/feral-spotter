# Punchlist triage — 2026-08-02 test-drive

Source: `docs/design/2026-08-02-ui-bug-punchlist.md`. Triaged against open issues/milestones 2026-08-03. Clustering is approximate — not a deep-dive dependency analysis.

## Sprint clusters (MVP milestone)

| Sprint                     | Parent | Children                                                                                                                                                                                                 |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| camera                     | #144   | #145 repeated permission requests, #146 "Limited access" opens library picker, #147 mock submission path                                                                                                 |
| photo-selection _(new)_    | #158   | #159 submit w/o photos -> auto-route to Box Annotation, #160 verify persisted selection across reselect                                                                                                  |
| cat-observations           | #148   | #149 "Done" -> "Finished!" + hide-if-empty, #150 remove "Look" header, #151 remove Done/Cancel on Annotation Box, #152 Edit Cat missing-field validation, #153 relocate Reset to whole-submission screen |
| submission-details _(new)_ | #154   | #155 blocks submit with 0 cats, #156 drop back button / add Select-Take-More-Photos action, #157 Home -> Submission Details return path                                                                  |

## Implementation order

1. **Camera (#144)** — permission-handling bugs share root cause with #140, block clean testing of everything downstream.
2. **Photo Selection (#158)** — next screen in capture->submit flow; #159's auto-route-to-annotation change affects how Cat Observations gets reached.
3. **Cat Observations (#148)** — largest cleanup batch; depends on photo selection reliably handing off cats/photos.
4. **Submission Details (#154)** — final screen; #156's "Select/Take More Photos" action is easiest to wire once camera/photo-selection entry points are settled.

## Not new tickets (folded into existing issues)

- Shutter -> system Photo Picker: already #140, cross-linked to #145/#146.
- Media-consent "Don't allow" instant exit: commented on existing #66/#101 (overlap flagged in the punchlist itself).

## Design questions (wayfinder:grilling, children of map #31)

Block the consent flow (a P0 gating flow per #31), not the four sprints above.

- #162 — move camera/location permission priming earlier in first-run chain? Tension w/ PR #61 removing the old eager `PermissionPrimer`.
- #163 — rearrange first-run screen order (`intro-flow -> sign-in -> analytics-consent -> consent -> home`)?

## Beta-scope, outside sprint order

- #161 — cache instead of hard-delete on submission Reset. Target Beta/v1 per punchlist. Stale reference UUID: `d67a43e6-2eb6-438d-b178-807d44f8eb57` in `submission_cache_index`.

## Labels created for this triage

`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` (canonical triage set, `docs/agents/triage-labels.md`), plus `sprint:submission-details` and `sprint:photo-selection`.

Full record also posted as a comment on map issue #31.

---

## Detailed sprint briefs

Knowledge-transfer starting point, not a spec. Camera brief is code-verified (`src/hooks/useCameraCapture.tsx` read directly); the other three are inferred from the punchlist wording and prior issue context only — file paths there are guesses, not confirmed, and need a look before work starts.

### 1. Camera (#144)

**Root cause, verified.** `src/hooks/useCameraCapture.tsx`, `takePhoto` callback, ~L135-150. When `keepOnDevice` is true (user setting: save capture to device gallery too), every single shutter press does:

```ts
let status = await check(PERMISSION_MAP.mediaLibrary)
if (status !== GRANTED && status !== LIMITED) {
  status = await request(PERMISSION_MAP.mediaLibrary)
}
```

This `check` + conditional `request` runs inline in the capture path itself, not once at consent time — a comment on L136-138 explains it's intentional: issue #91 removed an eager consent-time request for this exact permission, so it moved here as a lazy request "at the point the write is actually needed." The gap the comment doesn't cover: if the OS status is anything other than `GRANTED`/`LIMITED` (denied-but-askable, or the Android "Limited access" partial-grant state), `request()` fires again on _every_ capture, not just the first. On Android 14+, `request()` for this permission itself surfaces the system Photo Picker (`ACTION_PICK_IMAGES`) as the OS's UI for "Select photos" — so from the user's POV, pressing the shutter opens a picker instead of capturing (#140), and it can recur on every shutter press (#145) or after picking "Limited access" specifically (#146).

- **#145** (repeated permission requests): fix is likely gating the request so it only fires once per session/permanently-denied state, or caching a "user already said no this session" flag — needs a decision on UX (silently skip gallery-save vs. re-prompt) since PR #61's whole point was avoiding double-asks.
- **#146** ("Limited access" opens picker): same code path — Android's partial-access grant flow re-enters the picker; verify whether `status === RESULTS.LIMITED` is actually being treated as terminal (it is, per the code above) or whether the OS keeps re-surfacing the picker on subsequent `check()` calls regardless.
- **#147** (mock submission path): unrelated to the permission bug — separate need for a stub/mock submission flow to test capture->submit without hitting the real backend. No code context gathered; scope it fresh.
- **#140** itself (already filed, not re-created here) is the same root cause as #145/#146 — worth fixing all three together in one pass through this function rather than three separate patches.

### 2. Photo Selection (#158)

Not code-verified — inferred from punchlist wording only.

- **#159** (submit w/o clicking photos -> should auto-route to Box Annotation): punchlist frames this as a flow-order problem — today, selecting photos is presented as a small, easy-to-miss option on the Observed Cat screen, and the screen lets you proceed without ever visiting it. The ask is to flip the default: land the user in Box Annotation automatically after photos are attached, and let them dismiss/discard photos "without the cat" from there instead of a separate opt-in step. This is a navigation/flow change (likely touches whatever screen sequences Observed Cat -> Box Annotation), not a pure UI tweak — treat as `ready-for-human` until someone maps the actual screen/route names.
- **#160** (verify persisted selection across reselect): this is a question, not a confirmed bug — "are previously selected photos still present?" after returning to the Library Picker. First step is reproducing/confirming, not fixing; labeled `needs-info` for that reason. Likely lives wherever the app tracks selected-photo state across navigation (a store or route param) — unconfirmed.

### 3. Cat Observations (#148)

Not code-verified — inferred from punchlist wording, cross-referenced against related _closed_ issues from the 2026-07-31 test-drive (#124/#125/#126/#116/#135/#130) which already touched this same screen family, so there's likely recent context in those diffs/PRs worth checking before starting.

- **#149** ("Done" -> "Finished!", hide if cat list empty): straightforward label + conditional-render change on whatever component renders the final-submit button. #130 (closed) already moved a "Done" button from Cat Observations to Submission Details — worth checking whether this is the _same_ button post-move or a different one, since the punchlist still calls it "Cat Observations screen."
- **#150** (remove "Look" header on Observed Cat screen): simple header removal, low risk.
- **#151** (remove "Done"/"Cancel" on Annotation Box screen): simple button removal — but check what currently drives navigation away from this screen if both buttons disappear; something needs to replace their implicit "confirm and leave" function, or the screen needs another exit path already.
- **#152** (Edit Cat: no missing-field validation warning): needs whatever form-state the Edit Cat screen already holds (species/pattern/color etc. — color-by-pattern constraint already exists per closed #96) extended with a required-field check before allow-save/continue.
- **#153** (relocate Reset from Edit Cat to whole-submission screen): punchlist is explicit the button's _logic_ already works correctly — this is placement only, move the existing handler up a level to wherever Submission Details/Cat Observations list-level actions live (likely alongside where #149's Finished! button ends up).

### 4. Submission Details (#154)

Not code-verified — inferred from punchlist wording only. This is the newest cluster with the least existing issue history to cross-reference against.

- **#155** (submit possible with 0 cats): validation gate — needs a count check on whatever list backs "cats in this submission" before enabling/allowing the submit action.
- **#156** (remove back button, add Select/Take More Photos action): two changes bundled — hide/remove an existing back-navigation control, and add a new bottom action. Punchlist explicitly leaves open _which_ label ("Select More Photos" vs "Take More Photos") — may need both (branching by entry point: came from camera vs. library) rather than picking one; flagged `ready-for-human` for that reason.
- **#157** (Home -> Submission Details return path not obvious): pure UX/discoverability problem, no described mechanism — likely needs a resume-in-progress-submission affordance on Home (a card/banner) rather than a screen-level fix. Least specified of all four sprints; expect this one needs a design pass before an agent can implement it blind.
