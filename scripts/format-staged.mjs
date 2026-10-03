#!/usr/bin/env node
/**
 * Pre-commit gate (lint-staged style). Operates only on what is staged, so it
 * needs no base branch. It stops the two mistakes that otherwise reach CI:
 *
 * 1. Line endings. A script that rewrites a file in text mode flips CRLF to
 *    LF, so a 2-line edit becomes a whole-file diff — and prettier passes
 *    that diff, because LF is valid. The staged line ending is compared with
 *    HEAD's. Intentional renormalizing: ALLOW_EOL_CHANGE=1 git commit
 * 2. Formatting. The prettier pinned in package-lock.json (the one CI runs)
 *    rewrites the staged files and restages them. A partly staged file is
 *    only checked, never rewritten: restaging it would sweep in unstaged
 *    hunks.
 *
 * Usage: node scripts/format-staged.mjs
 */
import { execFileSync } from 'node:child_process'
import { createPrettierRunner, git, isFormattable } from './format-shared.mjs'

const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean)
if (staged.length === 0) process.exit(0)

const blob = (spec) => {
  try {
    return execFileSync('git', ['show', spec], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null // path is not in HEAD: a newly added file
  }
}
const hasCR = (buffer) => buffer.includes(0x0d)
const isBinary = (file) => git('ls-files', '--eol', '--', file).startsWith('i/-text')

const eolProblems = []
for (const file of staged.filter((f) => !isBinary(f))) {
  const inIndex = hasCR(blob(`:${file}`))
  const inHead = blob(`HEAD:${file}`)
  if (inHead === null) {
    if (inIndex) eolProblems.push(`${file}: new file has CRLF line endings`)
  } else if (hasCR(inHead) !== inIndex) {
    eolProblems.push(`${file}: line endings flipped ${inIndex ? 'LF to CRLF' : 'CRLF to LF'}`)
  }
}
if (eolProblems.length > 0 && !process.env.ALLOW_EOL_CHANGE) {
  console.error('pre-commit: line endings changed. A script probably rewrote these files:\n')
  for (const problem of eolProblems) console.error(`  ${problem}`)
  console.error(
    '\nUndo with `git restore --staged <file>` and `git checkout -- <file>`, then redo the edit' +
      '\nwith an editor tool that keeps line endings. If this is intentional renormalizing,' +
      '\nrun the commit again with ALLOW_EOL_CHANGE=1.',
  )
  process.exit(1)
}

const formattable = staged.filter(isFormattable)
if (formattable.length === 0) process.exit(0)

let prettier
try {
  prettier = createPrettierRunner()
} catch (err) {
  console.error(`pre-commit: ${err.message}`)
  process.exit(1)
}

const partlyStaged = new Set(git('diff', '--name-only', '--', ...formattable).split('\n').filter(Boolean))
const rewritable = formattable.filter((f) => !partlyStaged.has(f))
const checkOnly = formattable.filter((f) => partlyStaged.has(f))

if (rewritable.length > 0) {
  prettier(['--write', '--log-level', 'warn', '--', ...rewritable])
  git('add', '--', ...rewritable)
}

if (checkOnly.length > 0) {
  try {
    prettier(['--check', '--log-level', 'warn', '--', ...checkOnly])
  } catch {
    console.error('pre-commit: these files are partly staged and not formatted.')
    console.error('Stage or stash the rest of each file, run `npm run format`, and commit again.')
    process.exit(1)
  }
}
