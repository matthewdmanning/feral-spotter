---
topic: cat-list-empty-state
status: active
last_reviewed: 2026-08-25
governs:
  - src/screens/submission/create/index.tsx
  - src/screens/submission/cats/index.tsx
  - src/hooks/useRemoveCat.ts
derives_from: ['#299']
---

# What the Cat List shows when there are no cats — current design state

## The two situations

The Cat List can be empty for two very different reasons, and the app treats
them differently.

**You just started.** You have taken photos, and you have not recorded any cats
yet. The app sends you straight to the photos so you can draw a box around a cat
you see. There is nothing useful to show on an empty list at this point — you
have to look at the photos before you can describe anything.

**You removed your last cat.** You had at least one cat recorded and you deleted
it. This is not the same as starting fresh: you have already seen the photos, and
you deleted that cat for a reason. Maybe you boxed the wrong animal. Maybe you
counted the same cat twice. Maybe you want to describe the cat differently.

## What you see after removing your last cat

The list stays where it is and shows:

> No cats recorded. Pick one out of your photos, or describe a cat you saw. Your
> photos are still here either way.

with two buttons:

- **Annotate Photos** — go back to the photos and box a cat.
- **Describe a Cat** — go straight to the form and describe a cat without
  pointing at it in a photo.

Both are offered. Neither happens on its own.

## Why you get a choice instead of being sent back to the photos

Being sent back to the photos assumes you want to try boxing again. That is often
true, but not always. You might have seen a cat you cannot pick out of any
photo — it moved, it was too far away, it is behind something. That sighting is
still worth recording, and forcing you back to the photos would mean you had to
box _something_ before the app would let you describe what you actually saw.

So the app offers both routes and lets you decide.

## Why "Describe a Cat" exists at all

A cat recorded this way has no photos attached to it. That is allowed on purpose.
A cat you saw but could not photograph clearly is still a real sighting, and the
record is more useful than no record.

Cats you box in photos are still the normal path — **Annotate Photos** is listed
first, and looks like the main button, because it is what most people want.

## What removing a cat does and does not touch

Removing a cat asks you to confirm first, and the confirmation says what
survives:

> This removes the cat and the boxes you drew for it. Your photos are not
> deleted, and your other cats are not affected.

- **Gone:** that cat, and the boxes you drew for it.
- **Kept:** all your photos, and every other cat.

Photos are kept because one photo can show more than one cat. Deleting a photo
because you removed one cat would take away evidence for a cat you are still
recording.

## Submitting with no cats

You cannot submit a sighting with no cats in it. The **Finished!** button is
visible on the empty list but does not work until you record at least one cat.
It stays visible rather than disappearing so the screen does not change shape
underneath you.

## Where you can remove a cat

Two places, and both behave the same way:

- The trash icon on a cat's row in the Cat List.
- **Remove this Cat** at the bottom of the form, when you are editing a cat you
  already saved.

A cat you have not saved yet has no Remove button — backing out of it is a
different action, with its own prompt.

## Still open

Whether the trash icon on each row is the right control, or whether it should be
something else, is for MVP testing to answer. Swipe-to-delete was tried and
removed because it interfered with annotating.
