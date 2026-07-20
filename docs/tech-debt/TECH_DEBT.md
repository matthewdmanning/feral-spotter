# Tech Debt

TODO list of known chores — things that are broken, degraded, or deliberately deferred but not blocking current work.

Tech-debt work is tagged `chore` on GitHub Issues, commits, and PRs (see `CLAUDE.md` Git Workflow).

## Open

- **Nitro image module lacks New Architecture support** — `react-native-nitro-image` is flagged by `expo-doctor`'s React Native Directory check as untested on the New Architecture. Not fixable as a drop-in library swap; requires writing a new camera module.
- **Peer-dependency conflict on install** — `npm install` fails without `--legacy-peer-deps` due to a `react-native`/`@react-native/jest-preset`/`jest-expo` version mismatch. Debug log: `docs/tech-debt/2026-07-12-peerdep-report.txt`. See [#17](https://github.com/matthewdmanning/feral-spotter/issues/17).
