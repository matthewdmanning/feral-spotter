# Reference: feature flag best practices

## Core practices

Source: Pete Hodgson, "Feature Toggles", martinfowler.com (Web search).

| Practice                                 | What to do                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sort flags by type                       | **Release:** remove in one to two weeks. **Experiment:** keep until the results are significant. **Ops:** must change without a new release. **Permissioning:** can live for years. |
| Separate the decision from the call site | Put one named decision function between the flag and the call site, for example `includeOrderCancellationInEmail()`. Logic changes then touch one place.                            |
| Inject decisions                         | Give modules a config object at construction. This lets you test modules without the flag system.                                                                                   |
| Keep long-lived flags out of `if`s       | Use a Strategy pattern for long-lived flags. Use a plain `if` only for short-lived flags.                                                                                           |
| Keep flag config in source control       | Use a remote flag service only when a flag must change without a release.                                                                                                           |
| Test in a limited set of states          | Test the production config with the new flags on. Test the fallback with the new flags off. Do not test every combination.                                                          |
| Treat flags as debt                      | When you add a flag, add a task to remove it. Set an expiry date. Some teams make a test fail after the expiry date. Limit the number of live flags.                                |
| Show the current state                   | Let an operator see which flags are on.                                                                                                                                             |
| Use one convention                       | Off means the old behavior. On means the new behavior.                                                                                                                              |

## Mobile clients

Source: PostHog docs, through Context7.

- Always give a default value, for example
  `useFeatureFlagEnabled('key', false)`. Without a default, the value is
  `undefined` while flags load.
- Bootstrap known values at startup with `bootstrap.featureFlags`. This
  prevents a flicker on the first render.
- Make sure a failed load falls back to the default behavior.

## Sources

- [Feature Toggles (aka Feature Flags), martinfowler.com](https://martinfowler.com/articles/feature-toggles.html)
- [Feature Flag, Martin Fowler bliki](https://martinfowler.com/bliki/FeatureFlag.html)
- [PostHog: Bootstrapping feature flags](https://posthog.com/docs/feature-flags/bootstrapping)
- [PostHog: Adding feature flag code](https://posthog.com/docs/feature-flags/adding-feature-flag-code)
