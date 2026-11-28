# Reference: consent timing, delays and offline use

General reference. Not project rules. Covers when to ask for consent, how long to wait for a stored or remote consent state, and what to do offline.

Evidence: web-search excerpts of the sources below. Full documents were not read. Check the source before you quote a paragraph number.

## Default state and waiting

| Finding                                                                   | Source                      |
| ------------------------------------------------------------------------- | --------------------------- |
| Set a default consent state first, before any code reads or writes data.  | [^google-consent-setup]     |
| Do not set the default asynchronously. Code that runs first defeats it.   | [^google-consent-debug]     |
| The default for storage and tracking is `denied` until the user chooses.  | [^google-consent-setup]     |
| `wait_for_update` (ms) holds the default while a late consent tool loads. | [^google-consent-setup]     |
| Google's example uses 500 ms. It is an example, not a stated norm.        | [^google-consent-setup]     |
| If the update step makes network calls, wait at least 500 ms.             | [^google-consent-templates] |
| No source here defines behaviour when the wait expires with no update.    | —                           |
| No source here gives a wait for mobile apps.                              | —                           |

## Cached and offline consent data

From OneTrust's mobile SDK, one vendor's design.

| Finding                                                                       | Source                   |
| ----------------------------------------------------------------------------- | ------------------------ |
| Bundled offline data must be supplied before the SDK starts.                  | [^onetrust-ios-offline]  |
| Android: `loadOffline` plus `setOfflineData`. No data at all: start-up fails. | [^onetrust-android-init] |
| Per component, cached data wins. Bundled offline data is the fallback.        | [^onetrust-ios-offline]  |
| Fallback still counts as success. A warning flags stale or offline data.      | [^onetrust-ios-offline]  |
| User-specific consent strings are stripped from bundled data before use.      | [^onetrust-ios-offline]  |
| Consent logging still calls the network when it is available.                 | [^onetrust-ios-offline]  |
| Android clears cached UI data on each successful online start.                | [^onetrust-android-init] |

## Access must not depend on optional consent

| Finding                                                                                        | Source                    |
| ---------------------------------------------------------------------------------------------- | ------------------------- |
| Cookie walls generally make consent not freely given, so invalid.                              | [^edpb-05-2020]           |
| Example 6a: content hidden behind an accept button gives no genuine choice.                    | [^edpb-05-2020]           |
| Do not manipulate, trick or force consent to unnecessary data access. Offer alternatives.      | [^apple-review-5-1-1]     |
| Do not require tracking, location or push permission to access functionality.                  | [^apple-review-5-1-1]     |
| Contact details (name, email) may be asked only if optional. Features must not depend on them. | [^apple-review-5-1-1]     |
| Apps should still work when people decline to share data.                                      | [^apple-privacy-data-use] |

## When to ask

| Finding                                                                                                | Source                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------- |
| Ask when people use the feature that needs the data.                                                   | [^apple-hig-privacy]    |
| Ask at launch only when the app cannot function without the data, and the reason is clear.             | [^apple-hig-privacy]    |
| Asking before people show interest in a feature erodes trust.                                          | [^apple-hig-privacy]    |
| Ask when the user would expect it. Avoid choices on first open.                                        | [^apple-wwdc25-privacy] |
| A custom pre-prompt screen is allowed only if essential. One "Continue" button, then the system alert. | [^apple-hig-privacy]    |

## Records and withdrawal

| Finding                                                                         | Source         |
| ------------------------------------------------------------------------------- | -------------- |
| The controller must be able to show that the person consented (Art. 7(1)).      | [^gdpr-art-7]  |
| Keep an audit trail of how and when consent was given.                          | [^ico-consent] |
| Withdrawal at any time; no harder than giving consent (Art. 7(3)).              | [^gdpr-art-7]  |
| Withdrawal should be one easy step, ideally by the same method used to consent. | [^ico-consent] |
| Withdrawal does not make earlier processing unlawful.                           | [^gdpr-art-7]  |
| No source here sets a retry policy for sending consent records.                 | —              |
| No source here resolves conflicting choices across devices.                     | —              |

## Human response-time limits

| Limit | Meaning                                                      | Source          |
| ----- | ------------------------------------------------------------ | --------------- |
| 0.1 s | Feels instant. The user feels they caused the result.        | [^nng-response] |
| 1 s   | Flow holds. Beyond it, users notice the wait and adapt.      | [^nng-response] |
| 10 s  | Attention limit. Beyond it, show progress and a way to stop. | [^nng-response] |

NN/g says the limits vary by context, but should still be 0.1, 1 or 10 s.[^nng-response]

## Sources

Format: `[^id]: Publisher. "Title". <URL>. Accessed: YYYY-MM-DD.`

[^google-consent-setup]: Google for Developers. "Set up consent mode on websites". <https://developers.google.com/tag-platform/security/guides/consent>. Accessed: 2026-11-28.

[^google-consent-templates]: Google for Developers. "Create a consent mode template". <https://developers.google.com/tag-platform/tag-manager/templates/consent-apis>. Accessed: 2026-11-28.

[^google-consent-debug]: Google for Developers. "Troubleshoot consent mode with Tag Assistant". <https://developers.google.com/tag-platform/security/guides/consent-debugging>. Accessed: 2026-11-28.

[^onetrust-ios-offline]: OneTrust Developer Portal. "iOS Offline Mode". <https://developer.onetrust.com/onetrust/docs/ios-offline-mode.md>. Accessed: 2026-11-28.

[^onetrust-android-init]: OneTrust Developer Portal. "Initialize the SDK (Android)". <https://developer.onetrust.com/onetrust/docs/initialize-sdk-android-next-gen>. Accessed: 2026-11-28.

[^edpb-05-2020]: European Data Protection Board. "Guidelines 05/2020 on consent under Regulation 2016/679, v1.1". <https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf>. Accessed: 2026-11-28.

[^apple-review-5-1-1]: Apple Developer. "App Review Guidelines, 5.1.1 Data Collection and Storage". <https://developer.apple.com/app-store/review/guidelines/>. Accessed: 2026-11-28.

[^apple-privacy-data-use]: Apple Developer. "User Privacy and Data Use". <https://developer.apple.com/app-store/user-privacy-and-data-use/>. Accessed: 2026-11-28.

[^apple-hig-privacy]: Apple Developer. "Human Interface Guidelines: Privacy". <https://developer.apple.com/design/human-interface-guidelines/privacy>. Accessed: 2026-11-28.

[^apple-wwdc25-privacy]: Apple Developer. "Integrate privacy into your development process (WWDC25)". <https://developer.apple.com/videos/play/wwdc2025/246/>. Accessed: 2026-11-28.

[^gdpr-art-7]: Regulation (EU) 2016/679 (GDPR). "Art. 7 Conditions for consent". <https://gdpr-info.eu/art-7-gdpr/>. Accessed: 2026-11-28.

[^ico-consent]: UK Information Commissioner's Office. "How should we obtain, record and manage consent?". <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/>. Accessed: 2026-11-28.

[^nng-response]: Nielsen Norman Group. "Response Times: The 3 Important Limits". <https://www.nngroup.com/articles/response-times-3-important-limits/>. Accessed: 2026-11-28.
