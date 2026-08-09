#!/usr/bin/env node
/**
 * Format staged files with prettier before commit (lint-staged style).
 * No base branch needed — operates only on what's about to be committed.
 *
 * Usage: node scripts/format-staged.mjs
 */
import { execSync } from 'node:child_process'

const SUPPORTED = /\.(tsx?|jsx?|json|md|ya?ml)$/

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

const files = sh('git diff --cached --name-only --diff-filter=ACMR')
  .split('\n')
  .filter((f) => f && SUPPORTED.test(f))

if (files.length === 0) {
  process.exit(0)
}

const args = files.map((f) => JSON.stringify(f)).join(' ')
try {
  execSync(`npx prettier --write ${args}`, { stdio: 'inherit' })
  execSync(`git add ${args}`, { stdio: 'inherit' })
} catch {
  process.exit(1)
}
