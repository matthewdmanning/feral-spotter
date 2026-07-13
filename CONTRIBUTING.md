# Contributing

Standards for working on FeralSpotter: workflow, code style, and quality gates.

## Workflow

### Branches

- If there's an open Issue for the work, name the branch `issue-{number}-short-description` (e.g. `issue-14-update-readme`).
- If there's no Issue (small/exploratory work), use a type-prefixed name instead: `feat-*`, `fix-*`, `ui-*`, `chore-*`.
- Delete the branch after the PR is merged.

### Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>[scope]: <description>`

Allowed types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `build`, `perf`.

### Pull requests

- Use `.github/PULL_REQUEST_TEMPLATE.md`.
- If the PR resolves an Issue, include `Closes #<number>` in the PR body and the merge commit message.
- Prefer merge commits or rebase merges over squash merges to preserve commit history.

## Code style

- Formatting: [Prettier](.prettierrc) (`tabWidth: 2`, spaces not tabs).
- Linting: [ESLint](eslint.config.js), based on `eslint-config-expo`.

Run before pushing:

```bash
npm run lint       # ESLint via expo lint
npm run typecheck  # tsc --noEmit
```

## Quality

- New code must include unit tests and basic integration tests to pass PR review.
- Bringing existing, untested code up to this standard is tracked separately (see [#15](https://github.com/matthewdmanning/feral-spotter/issues/15), "Code coverage for core features") rather than required on unrelated PRs.

Run before pushing:

```bash
npm test           # Jest
```

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`: lint, typecheck, tests with coverage (uploaded to Codecov). All three must pass before merge.
