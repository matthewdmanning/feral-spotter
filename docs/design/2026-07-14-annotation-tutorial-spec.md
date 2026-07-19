# Spec: Guided First-Run Annotation Tutorial

**Status:** Draft v2 (retargeted per 2026-07-12 roadmap) · **Target:** Alpha (Play Store release) · **Owner:** Matthew
**Estimated effort:** 2–3 dev-days · **Milestone rationale:** roadmap decision 10 — tutorial is redundant for personally-briefed MVP testers; earns its cost when testers are strangers via Play Store

---

## Problem Statement

Annotation is FeralSpotter's highest-value, highest-friction feature. At Alpha, testers arrive via the Play Store as strangers — nobody briefs them — so they hit the annotation screen cold and either mislabel photos or abandon the flow. Bad annotations poison the downstream ML training set (FeralSegmentor integration, v2.0), so a tester who "sort of figures it out" is worse than one who is taught once, correctly.

## Goals

1. **≥70% of new users complete the tutorial** on first annotation entry (PostHog).
2. **Tutorial completes in under 90 seconds** median.
3. **First real annotation is usable for ML** — reduce malformed/empty annotations from first-time users to near zero.
4. Zero contamination: tutorial produces **no submission, no stored photo, no persisted annotation**.

## Non-Goals

- **Whole-app tour** (home/submissions/settings) — annotation is the only flow that needs teaching; revisit if Alpha PostHog funnels show drop-off elsewhere.
- **Camera capture instruction** — camera UX is standard OS behavior; one text line in the tutorial covers it. Don't tutorialize the camera itself.
- **Consent screen** — separate MVP deliverable (roadmap Phase 3, issue 7); tutorial fires after consent, never replaces it.
- **Video or animated assets** — build cost too high for Alpha window.
- **Localization** — English only through Alpha.
- **Coach marks elsewhere in the app** — parking lot for Beta/v2.0.

## User Stories

1. As a first-time Play Store tester, I want to practice annotating on a sample photo so my first real observation isn't ruined by trial-and-error.
2. As a returning user, I want to replay the tutorial from Settings so I can refresh my memory after time away.
3. As an experienced tester, I want to skip the tutorial in one tap so it never blocks my work.
4. As the project owner, I want tutorial funnel events in PostHog so I know where testers drop off.

## Design

### Trigger

- Fires when the user opens `AnnotationTool` for the first time **and** `settings.annotation_enabled` is true.
- Gate on a persisted flag `tutorial.annotation_completed` (new slice in settings/Zustand store, AsyncStorage-persisted). Values: `unseen | skipped | completed`.
- If `skipped`: never auto-fires again. Replay only via Settings → "Replay annotation tutorial".

### Tutorial Session (sandboxed)

- Bundled sample asset: one real feral-cat photo (ear-tipped, clear subject) shipped in `assets/tutorial/`. Full resolution not required — this photo never enters the ML pipeline.
- Runs the **real `AnnotationTool` component** in a `tutorialMode` prop/flag. Do not build a parallel fake screen — reuse the plugin-registry tool with a mock store context.
- Tutorial annotation state lives in an **ephemeral store instance** (or a `tutorial: true` flag branch), never written to the submission store, photo utils, or backend. Discarded on exit — no cleanup job needed.
- `photos_reviewed` and other confirmation guards are suppressed in tutorialMode (no real cat's annotations at risk).

### Steps (5 total)

Each step = dimmed overlay + one instruction card + spotlight on the relevant control. **Advance by doing, not by tapping Next** (steps 2–4 validate the actual gesture).

| # | Step | Instruction (draft copy) | Advance condition |
|---|------|--------------------------|-------------------|
| 1 | Welcome | "Let's practice on a sample photo. In the app you'll get here by taking or picking a photo of a cat. Takes about a minute." | Tap **Start** (or **Skip**) |
| 2 | Draw | "Drag to draw a box around the cat. Get the whole body inside." | Valid annotation shape created |
| 3 | Adjust | "Drag a corner to tighten the box to the cat's edges." | Shape edited (any handle moved) |
| 4 | Label | "Pick what you see. Ear-tip = already neutered — it matters." | Label/attribute applied |
| 5 | Done | "That's it. Real photos save automatically to your submission. Replay anytime from Settings." | Tap **Finish** |

- **Skip** visible on every step (top-right, one tap → sets `skipped`, exits to real screen).
- Copy tone: short, plain, one idea per card. Max 2 lines per card.

### Components

- `TutorialOverlay` — NativeWind overlay: scrim + card + spotlight cutout. Step state = local `useState`/`useReducer`; only the completion flag is persisted.
- `Settings` — add "Replay annotation tutorial" row (resets flag to `unseen`, navigates to tutorial).
- No new deps. Spotlight cutout via absolute-positioned views + measured target layout (`onLayout`/refs) — skip fancy SVG masking if it fights you; a simple highlight border is acceptable for beta.

### Analytics (typed event union, PostHog)

By Alpha, the capture/annotate funnel and `posthog.captureException` exist (MVP Phase 3, issue 8) — tutorial events join that catalogue. Google Sign-In gives per-tester attribution, so tutorial completion can be joined against each tester's real annotation quality.

- `tutorial_started`
- `tutorial_step_completed` — `{ step: 1–5 }`
- `tutorial_skipped` — `{ step }`
- `tutorial_completed` — `{ duration_ms }`

## Requirements

### P0 — beta does not ship without

- [ ] Tutorial auto-fires exactly once on first annotation entry; never again after complete/skip.
- [ ] All 5 steps completable on Android with the real AnnotationTool against the bundled sample photo.
- [ ] Skip works from every step in one tap.
- [ ] Sample photo + tutorial annotations never persist: nothing in submission store, photo storage, GCS upload, or exports. Clear-cache and photo-cleanup utils untouched. Tutorial never hits `app/upload+api.ts`.
- [ ] Completion flag survives app restart (AsyncStorage).
- [ ] All four analytics events fire with correct payloads.
- [ ] Unit tests: flag persistence, tutorialMode store isolation, skip-at-each-step.

### P1 — fast follow

- [ ] Settings replay row (if it slips, testers just can't replay — acceptable).
- [ ] Step 3 (Adjust) tolerance polish — accept "close enough" edits gracefully.

### P2 — future, design around

- Whole-app coach marks reusing `TutorialOverlay`.
- Per-tool tutorials as annotation plugins grow (overlay should take steps as data, not hardcode them).
- iOS gesture verification (post-beta, with iOS builds).

## Acceptance Criteria (key paths)

- **Given** a fresh install with annotation enabled, **when** the user first opens the annotation screen, **then** the tutorial starts on the sample photo, and the user's actual photo/submission is untouched and waiting after exit.
- **Given** the user skips at step 2, **when** they reopen the annotation screen, **then** no tutorial fires and their prior work is intact.
- **Given** the user completes the tutorial, **when** cache is cleared or photo cleanup runs, **then** no tutorial artifacts appear or interfere.
- **Given** the tutorial is mid-step, **when** the app is backgrounded and killed, **then** next annotation entry restarts the tutorial cleanly (no half-state).

## Success Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Tutorial completion rate | ≥70% (stretch 85%) | PostHog funnel, first 2 weeks post-Play Store release |
| Median completion time | <90s | `tutorial_completed.duration_ms` |
| Skip rate at step 1 | <20% | `tutorial_skipped` where step=1 |
| First real annotation malformed/empty | ~0 | Manual review of GCS uploads (backend validates type/size/MIME only, not annotation quality) |

Evaluate 1 week after store listing goes live; if step 2→3 drop-off >25%, the draw gesture needs work — that's a product signal, not a tutorial signal. Per-tester attribution (Google Sign-In) lets you compare annotation quality of completers vs. skippers.

## Open Questions

- **(You, blocking)** Which sample photo? Needs an ear-tipped cat, unambiguous single subject, and rights to ship it in the binary.
- **(You, non-blocking)** Does `AnnotationTool` currently accept an injected store/context, or is the Zustand annotation store a module singleton? If singleton, tutorialMode needs a reset-on-exit path — flags the isolation risk in P0 #4.
- **(Non-blocking)** Should step 4 require the correct label (ear_tipped) or any label? Recommendation: any label — teach the mechanic, not a quiz.

## Timeline

- **Milestone: Alpha** (roadmap decision 10). Not MVP scope — do not build during the MVP window.
- **Dependencies:** AnnotationTool stable through the MVP 2-week trailing window; PostHog capture/annotate funnel live (MVP Phase 3, issue 8); consent screen shipped (tutorial fires after consent).
- **Build window:** early in Alpha, alongside the data-transparency page — the tutorial must be P0-complete before the store listing goes live, since it exists precisely for un-briefed store testers.
- **Cut line:** if the tutorial threatens the store submission date, fall back to a 3-card static intro (screenshots + text) before first annotation — half a day, ships something, doesn't slip the listing.
- Track as GitHub Issues under an Alpha milestone alongside the auth/registration rework, Sentry, and website page.

## Roadmap alignment (2026-07-12)

Supersedes the "ships with v1 beta / 2-week sprint" framing of Draft v1. Milestones are now MVP (trusted testers, Android, real GCS upload) → Alpha (Play Store + tutorial + website + Sentry + auth rework) → Beta (iOS parity) → v2.0 (FeralSegmentor/FeralTracker integration). MVP testers are personally briefed, so the tutorial's first users are Alpha store installs.
