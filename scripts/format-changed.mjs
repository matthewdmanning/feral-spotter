#!/usr/bin/env node
/**
 * Gradual prettier rollout: format (or --check) only the files this branch
 * changed versus the base branch — so the repo converges to prettier style
 * file-by-file as they're touched, instead of one big-bang reformat.
 *
 * Usage:
 *   node scripts/format-changed.mjs           # prettier --write changed files
 *   node scripts/format-changed.mjs --check   # prettier --check (CI gate)
 *
 * Base branch: PRETTIER_BASE env var (CI sets this to the actual PR base).
 * No local auto-detection — guessing the base among concurrent branches
 * produced wrong answers more often than right ones, and the pre-push hook
 * only ever used it to force spurious reformat commits, never to catch a
 * real regression. Without PRETTIER_BASE set, this is a no-op.
 */
import { execSync } from 'node:child_process'

const check = process.argv.includes('--check')
const SUPPORTED = /\.(tsx?|jsx?|json|md|ya?ml)$/

// Deliberately still in the older column-aligned layout — see commit 80bf6cf
// and docs/implementations/2026-08-26-issue-325-touch-targets.md. Reformatting
// them buries real edits in formatting noise; the whole-repo reformat is its
// own branch. Drop an entry once that branch lands and the file converts.
const COLUMN_ALIGNED = new Set([
  'src/components/atoms/ErrorBoundary.styles.ts',
  'src/components/atoms/SegmentedControl.styles.ts',
  'src/components/molecules/AddAnotherCatDialog.styles.ts',
  'src/components/molecules/BottomButtonColumn.styles.ts',
  'src/components/molecules/PhotoPreviewModal.styles.ts',
  'src/components/molecules/ReportCard.styles.ts',
  'src/components/organisms/DateTimePicker.styles.ts',
  'src/components/organisms/ValidationSheet.styles.ts',
  'src/screens/analytics-consent/index.styles.ts',
  'src/screens/settings/index.styles.ts',
])

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

if (!process.env.PRETTIER_BASE) {
  console.log('prettier: PRETTIER_BASE not set, skipping')
  process.exit(0)
}

let base = ''
try {
  base = sh(`git merge-base HEAD ${process.env.PRETTIER_BASE}`)
} catch {
  console.log(`prettier: no merge-base with ${process.env.PRETTIER_BASE}, skipping`)
  process.exit(0)
}

const files = sh(`git diff --name-only --diff-filter=ACMR ${base} HEAD`)
  .split('\n')
  .filter((f) => f && SUPPORTED.test(f) && !COLUMN_ALIGNED.has(f))

if (files.length === 0) {
  console.log('prettier: no changed files to format')
  process.exit(0)
}

const mode = check ? '--check' : '--write'
const args = files.map((f) => JSON.stringify(f)).join(' ')
try {
  execSync(`npx prettier ${mode} ${args}`, { stdio: 'inherit' })
} catch {
  process.exit(1)
}
