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
  .filter((f) => f && SUPPORTED.test(f))

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
