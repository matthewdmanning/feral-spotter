# ts-ailiot

A Claude Agent SDK app that takes a GitHub issue number, implements the ticket in a target repo, and writes basic tests for it.

It is a standalone npm project living inside the feral-spotter repo. It has its own `package.json`, `tsconfig.json`, and `node_modules`, and the app's `tsconfig.json`, `jest.config.js`, and `eslint.config.js` exclude this folder.

## Setup

```
cd ts-ailiot
npm install
```

Set an API key in the shell that runs the agent. The SDK reads it from the process environment and does **not** load `.env` files:

```
$env:ANTHROPIC_API_KEY = "your-api-key"
```

Get a key from https://platform.claude.com/. `gh` must also be installed and authenticated (`gh auth status`) — the ticket is read through it.

## Run

```
npm start -- 210 --cwd C:\GitHub\some-repo
```

| Flag | Meaning |
| --- | --- |
| `<issue-number>` | Issue to implement (required) |
| `--cwd <path>` | Repo the agent may read and edit (required, never defaulted) |
| `--repo <owner/name>` | Repo to read the issue from; defaults to the one at `--cwd` |
| `--model <name>` | Model alias or full name |
| `--settings <scope>` | `none` (default), `project`, or `all` |
| `--dry-run` | Print the ticket, prompt, and resolved options, then exit |

Start with `--dry-run` against an unfamiliar repo — it makes no API call and shows exactly what the agent would be told.

## How it is wired

| Concern | Choice |
| --- | --- |
| System prompt | Claude Code preset plus appended ticket-implementer instructions (`src/agent.ts`) |
| Tools | `Read`, `Glob`, `Grep`, `Edit`, `Write`, `TodoWrite`, `Bash` auto-approved |
| Permission mode | `acceptEdits`, so the run is headless. Never `bypassPermissions` — `allowedTools` does not constrain that mode |
| Deny rules | `rm -rf`, `git reset --hard`, `git clean`, `git checkout --`, `git push`, `gh pr merge`, `gh release`. Deny rules are checked before the permission mode, so they hold even though `Bash` is auto-approved |
| Settings | `settingSources` is set explicitly. With the default `none`, the agent does not inherit the target repo's `.claude/` hooks, skills, plugins, or memory |
| Git state | The prompt tells the agent not to commit, push, or open PRs. Work is left in the working tree for review |

`--cwd` is required on purpose: an `acceptEdits` agent that silently defaulted to the current directory would edit whatever repo you happened to be standing in.

## Layout

| File | Role |
| --- | --- |
| `src/index.ts` | CLI entry: parse, fetch ticket, run or dry-run, set exit code |
| `src/cli.ts` | Argument parsing and validation |
| `src/ticket.ts` | Reads the issue via `gh issue view --json` |
| `src/agent.ts` | Prompt, options, and the message-streaming loop |

## Checks

```
npm run typecheck
```

## Docs

- Agent SDK overview: https://code.claude.com/docs/en/agent-sdk/overview
- TypeScript API reference: https://code.claude.com/docs/en/agent-sdk/typescript
- Permissions: https://code.claude.com/docs/en/agent-sdk/permissions
