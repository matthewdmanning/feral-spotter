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
 * Base branch: PRETTIER_BASE env (e.g. "origin/main"), else origin/main, else main.
 */
import { execSync } from 'node:child_process'

const check = process.argv.includes('--check')
const baseRef = process.env.PRETTIER_BASE || 'origin/main'
const SUPPORTED = /\.(tsx?|jsx?|json|md|ya?ml)$/

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

function mergeBase() {
  for (const ref of [baseRef, 'main']) {
    try {
      return sh(`git merge-base HEAD ${ref}`)
    } catch {
      // try next ref
    }
  }
  return ''
}

const base = mergeBase()
const range = base ? `${base} HEAD` : 'HEAD'

const files = sh(`git diff --name-only --diff-filter=ACMR ${range}`)
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
