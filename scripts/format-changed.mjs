#!/usr/bin/env node
/**
 * Gradual prettier rollout: format (or --check) only the files this branch
 * changed versus the base branch — so the repo converges to prettier style
 * file-by-file as they're touched, instead of one big-bang reformat.
 *
 * Usage:
 *   node scripts/format-changed.mjs                   # prettier --write changed files
 *   node scripts/format-changed.mjs --check            # prettier --check (CI gate)
 *   node scripts/format-changed.mjs --fail-on-change   # write, then exit 1 if it
 *                                                     # rewrote anything (pre-push)
 *
 * Base branch: PRETTIER_BASE env var (CI sets this to the actual PR base),
 * defaulting to origin/main. That default is fixed, NOT auto-detection of the
 * branch's real base — detection guessed wrong more often than right, and the
 * pre-push hook used it only to force spurious reformat commits. A fixed
 * default keeps the old failure mode away and still lets `npm run format`
 * write without the caller exporting an env var (awkward in PowerShell).
 */
import { execSync } from 'node:child_process'
import { createPrettierRunner, isFormattable } from './format-shared.mjs'

const check = process.argv.includes('--check')
const failOnChange = process.argv.includes('--fail-on-change')

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

const baseRef = process.env.PRETTIER_BASE || 'origin/main'

let base = ''
try {
  base = sh(`git merge-base HEAD ${baseRef}`)
} catch {
  console.log(`prettier: no merge-base with ${baseRef}, skipping`)
  process.exit(0)
}

const files = sh(`git diff --name-only --diff-filter=ACMR ${base} HEAD`)
  .split('\n')
  .filter((f) => f && isFormattable(f))

if (files.length === 0) {
  console.log('prettier: no changed files to format')
  process.exit(0)
}

let run
try {
  run = createPrettierRunner()
} catch (err) {
  console.error(`prettier: ${err.message}`)
  process.exit(1)
}
const prettier = (mode, paths) => run([mode, '--', ...paths], { stdio: 'inherit' })

if (check || !failOnChange) {
  try {
    prettier(check ? '--check' : '--write', files)
  } catch {
    process.exit(1)
  }
  process.exit(0)
}

// --fail-on-change: ask prettier which files it would actually rewrite, and
// report only those. The pre-push hook used to run a bare `git diff --quiet`
// after this script instead, which fires on ANY dirty file in the tree —
// including files prettier never looks at, like this .mjs. That reported
// "prettier reformatted changed files" for edits prettier had not touched.
//
// `prettier --list-different` exits 1 and prints the differing files on
// stdout; any other non-zero status is prettier itself failing, so surface it.
let different = []
try {
  run(['--list-different', '--', ...files])
} catch (err) {
  if (err.status !== 1) {
    process.stderr.write(String(err.stderr || err.message))
    process.exit(1)
  }
  different = String(err.stdout).trim().split('\n').filter(Boolean)
}

if (different.length === 0) {
  console.log('prettier: changed files already formatted')
  process.exit(0)
}

try {
  prettier('--write', different)
} catch {
  process.exit(1)
}

console.log('')
console.log('prettier reformatted these files. Commit them, then push again:')
for (const f of different) console.log(`  ${f}`)
process.exit(1)
