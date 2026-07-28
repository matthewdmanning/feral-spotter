# FeralSpotter

Mobile app for reporting feral-cat sightings: the user captures or uploads photos, tags a location, and submits the sighting to a shared backend.

## Language

### Sighting & location

**Submission**:
One reported feral-cat sighting — the unit the user builds and sends. Holds one or more photos and exactly one location.
_Avoid_: report, observation, entry

**Submission location**:
The single geographic point a Submission is tagged with, shared by every photo in it. An app-level value the user sees and (in some paths) sets; it is not the same thing as a photo's embedded EXIF. One Submission has one Submission location — separate places require separate Submissions.
_Avoid_: metadata, geotag, coordinates (when referring to the app-level value)

**Live fix**:
A device GPS reading taken once per Submission at camera-capture time. Trusted as authoritative for camera-captured photos and therefore not user-editable.
_Avoid_: GPS location, current location, geolocation (as a noun for the value)

**Map picker**:
The manual location-selection surface: a native, draggable map with a fixed center pin. The Submission location is whatever point sits under the pin when the user confirms. Used for uploaded photos and as the fallback when a Live fix is unavailable.
_Avoid_: map view, location selector, place picker

**Photo EXIF**:
The metadata tags physically embedded in an image file (including any GPS the source camera wrote). Read-only to this app — a possible *seed* for the Map picker, never the Submission location itself, and never rewritten by us.
_Avoid_: photo metadata (as a synonym for Submission location)
