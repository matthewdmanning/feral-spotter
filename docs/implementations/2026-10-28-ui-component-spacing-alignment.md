# Component spacing alignment: tabs, lists, accordion, button rows

**Scope:** refactor (UI spacing and layout)
**Issues/spec:** [mobile-ux-layout-best-practices.md](../agents/ui-ux/reference/mobile-ux-layout-best-practices.md)
**Date:** 2026-10-28
**Branch/PR:** `ui/component-spacing-alignment`

## Scope

**In scope:**

- [x] Bottom tab bar (`(home-tabs)/_layout.tsx`)
- [x] Lists: Feral Reports, Settings toggle lists, Cats Recorded
- [x] Accordion: Cats Recorded cat cards
- [x] Table: the open cat card's key/value rows
- [x] Two-button rows: dialog, date picker, location picker, intro flow, Settings footer, cat card actions

**Out of scope / not addressed:**

- Annotate bottom bar. It mixes a content-width button with two `flex1` buttons. Only its gap moved to a token.
- Segmented controls. They already use tokens and the 48dp floor.

## Intent

**Purpose:** Make similar elements share one spacing, one tap-target floor and one overflow behavior, so screens read as one system.

## Design decisions and reasoning

### One gap for every button row and stack

- **Decision:** `layout.stackGap` (12dp) for rows and stacks. Rows were 8 or 12.
- **Reason:** Same spacing for similar elements. 12dp is also the Material Components Android default button-group spacing (`android:spacing`).
- **Affected journey/state:** every two-button row.

### Button rows stack at large font size

- **Decision:** New `ButtonRow` molecule. It stacks when `fontScale >= BUTTON_ROW_STACK_FONT_SCALE` (1.3, in `config/constants.ts`).
- **Reason:** Reflow rule: stack a row that does not fit at large font scale. A named constant, per the tunable-parameters rule.
- **Affected journey/state:** all callers listed in scope.

### Tab bar on the 4dp grid, Material indicator size

- **Decision:** 24dp icon in a 64×32dp pill; 4dp pill padding; 12dp top padding. Was a 32dp icon, 2dp pill padding, 8dp top.
- **Reason:** 2dp was off the 4dp grid. 64×32 around 24 is the Material active indicator.
- **Affected journey/state:** Home, Reports, Settings tabs.

### Accordion header is the whole strip

- **Decision:** The card padding moved into the header `Pressable`. Header has `minHeight: controlHeight.control` (52) and a pressed state.
- **Reason:** The tap target was only the label line (28dp). Now the full-width strip is tappable and above 48dp.

### Key/value table

- **Decision:** Values right-aligned, `flexShrink: 1`, baseline-aligned with labels. Actions sit 16dp below the table (rows are 8dp apart).
- **Reason:** Long values wrap in their own column. Actions read as a separate group.

### Reports list is a FlatList

- **Decision:** `FlatList` with `keyExtractor`, `ListHeaderComponent`, `ListEmptyComponent`; `ReportCard` is `memo`. Scroll indicator on.
- **Reason:** `ScrollView` renders every card. A volunteer can hold up to 250 reports. Legend uses `gap`, not trailing margins.

### Settings dividers

- **Decision:** Toggle-list divider is a direct card child (`Fragment`, not a wrapper `View`).
- **Reason:** The wrapper put 16dp above the divider and 4dp below. Now 16dp on each side.

## What shipped

- `src/components/molecules/ButtonRow.tsx`, `ButtonRow.styles.ts` — new.
- `src/config/constants.ts` — `BUTTON_ROW_STACK_FONT_SCALE`.
- `ToggleRow` — `minHeight` 48, `gap` replaces `paddingRight`.
- `AlertHost`, `DateTimePicker`, `location-picker`, `intro-flow`, `settings`, `create` — use `ButtonRow`; local row styles removed.
- `cats` screen — Save and Remove form one action group (24dp above, 12dp between).
- `annotate` — bottom bar gap uses `layout.stackGap` (value unchanged).

## Tests

**Not tested:**

- No new test. The change is layout. The Jest Unistyles mock does not render layout, so a test would not catch a spacing failure. All existing tests pass unchanged.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit/model tests: `npx jest` (87 suites, 395 tests)
- [x] Lint: `npx eslint` on changed files (one pre-existing, intentional warning in `AlertHost.tsx`)
- [x] Formatting: `npx prettier --write`

**Unverified:**

- No emulator or device pass. Check on a device: tab pill size, accordion press state, Reports pull-to-refresh, and every `ButtonRow` at Android font size "Large" and above.

## Follow-ups and known limitations

- [ ] Device pass at default and largest font size, light and dark.
- Annotate bottom bar does not stack at large font size.

## Implementation updates

### 2026-10-28 — refactor

**Purpose:** `DESIGN.md` is deprecated; the best-practices doc governs. Apply what `DESIGN.md` held back, and replace a hand-rolled list choice with the installed library.
**Change:**

- `layout.gutter` 20 → 16 (`spacing.lg`). Layout values go on the 8dp grid (§2). Affects every screen edge.
- Submission: Reset moved to the title row as a danger `TextButton`, the same pattern as Cat Form's Clear. It still confirms. Take More Photos and Finished! now share one `ButtonRow`, primary last. The 67% width is gone; actions span the gutter.
- Feral Reports: `FlatList` → `FlashList`, the list library already used by the camera strip. Card gap moved to `ItemSeparatorComponent`, because FlashList's content style takes padding only.

**Hand-rolled audit:** no other component replaces an installed library. Checked: images (no RN `Image`; `expo-image` installed), date picker (wraps `@react-native-community/datetimepicker`), switch (RN `Switch`), dialogs (app-owned on purpose, #337), segmented control and accordion (no library installed for either). Open question: the tab bar is a styled JS `Tabs`; Expo Router native tabs give the native Material bar.

**Unverified:** no device pass for the gutter change or the Submission layout.
