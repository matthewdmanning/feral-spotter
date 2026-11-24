---
title: Submission backup
tags:
  - implementation
  - storage
---

# Submission backup

**Scope** — Feature #493

**Purpose** — Recover the submitted cat details, location, time, and a representative image if the primary Submission is lost.

## What shipped

- A Storage finalization function reads the uploaded Submission JSON generation. It records the original JSON in Firestore at `submissionBackupAccounts/{uidKey}/submissionBackups/{submissionId}`. `uidKey` is the lowercase SHA-256 hex digest of the Firebase Auth UID. The Firestore record also has the source generation and a bucket and path for the JPEG, when one is available.
- The representative image uses the first usable inset box in cat order. The inset bubble and the JSON use the first confirmed box for that cat. The function orients the photo, crops to the box, and writes a quality-80 JPEG bounded by 1920×1080 without enlarging it. It strips source image metadata. A Submission with no usable box or decodable photo keeps its full JSON backup.
- Retries use a generation-specific image path and a Firestore transaction. A newer generation supersedes the older backup. Account deletion removes both backup artifacts whether or not the user keeps the primary Sightings. A marker prevents late events from recreating the backup.

## Deployment

Provision a separate private Cloud Storage bucket and set the Functions parameter `SUBMISSION_BACKUP_BUCKET` to its bucket name before deploying Functions. Give the Functions service account object read, list, create and delete access to that bucket, source object read access, and Firestore document access. Enable public access prevention and uniform bucket-level access. Disable object versioning and soft delete and leave retention locks off so account erasure can remove the image. Deploy the Firestore index configuration with the feature. An unset bucket leaves backup generation disabled.

The trigger processes metadata generations finalized after deployment. A historical backfill would need to run those older generations through the same server function.

## Recovery

In the Firestore console, locate the backup document using the owner UID hash and Submission ID. Copy the `metadataJson` value into a local `metadata.json` file. When the record has an `image`, download the JPEG from its recorded bucket and path with an account authorized to recover Submission data. The resulting artifacts contain the original Submission data and its representative crop. The crop has its own pixel dimensions and cannot be used to recreate the original photo or RAW files.

## Verification

The Functions tests check crop selection, EXIF orientation, size bounds, format validation, and cleanup ordering. The Firestore and Storage emulator test checks delivery retries, replacement, and account erasure against both stores.
