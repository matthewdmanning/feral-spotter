# Organization sharing

**Spec:** [Organization membership and sharing](../planning/organization-membership-and-sharing.md)

Moved existing sharing controls and consent helpers into the sharing feature. Core directory/permission stores remain in organizations. Added member-authorized shared-Sighting pagination, map areas for approximate locations, precise pins only when consented, and read-only details. Authenticated photo delivery reencodes to JPEG without EXIF/XMP/IPTC or source URLs. Shared data is memory-only and cleared on blur, background, account change or lost access.

Tests: existing consent/management journeys; Functions `sharing/__tests__/photos.test.ts` verifies real metadata removal and authorization denial. Final verification is recorded after integration. No deployment or device check.
