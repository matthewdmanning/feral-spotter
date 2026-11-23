---
topic: kebab-case-topic # matches the filename
status: active # active | superseded
last_reviewed: YYYY-MM-DD # last date checked against the governed code
governs: # repo-relative code paths this decision describes
  - src/features/<feature>/screens/<route>/index.tsx
derives_from: [] # issue refs, e.g. ['#168']
---

# [Title] Design Decision Template

Frontmatter is required. It backs the staleness audit and is the only place dates, filenames and issue refs may appear. The body below must not contain them.

## Context

- Both glossary / common name and code identifier must be included. Example: "Done button" / `DoneButton`
- Any view, screen, or component in the specification. Parent or child components should not be listed unless their properties are described in the specification.
- The machine state and / or journey to the context, if not universal to the screen. Example: `DoneButton` is pressed when `widgetList.length == 0`.
- Dates, time, implementation information, filenames, commit or PR information, or analysis should never be included in the body (frontmatter excepted).

## Design Specifications

Specifications of the design as they have been approved by the designer -- without removing or adding any detail. It must not include elements that are not explicitly part of the decision.

Positive Example:

- `warningPopup` should disappear after {`cfg.warningPopupTime`}.
- `warningPopup` should have an aspect ratio of {`cfg.warningPopupAspectRatio`}.

## Reason

This is a brief why this design choice was made. It should focus _only_ on the UI or UX.

Example:

- The user must have sufficient time to see `warningPopup` and register its meaning.
- The user must not have to wait too long or they will lose interest.
- The aspect ratio must be pleasant or the user will experience discomfort.
