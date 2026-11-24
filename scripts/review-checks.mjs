#!/usr/bin/env node
/**
 * Mechanical PR checks for the pr-reviewer agent. Prints a short verdict,
 * never raw tool output.
 *
 *   node scripts/review-checks.mjs [baseRef]   # default origin/main
 *
 * Steps (each on the files changed since the merge-base):
 *   1. eslint: import boundaries, raw colors, copy literals (eslint.config.js)
 *   2. jest --findRelatedTests: tests related to the changed files
 * Exit: 0 clean, 1 findings, 2 a step crashed (a crash is never a pass).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const MAX_LINES = 20
const STEP_TIMEOUT_MS = 5 * 60 * 1000

const run = (cmd, args) =>
  spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: STEP_TIMEOUT_MS,
  })

const out = []
const crash = (step, result) => {
  console.log(
    `ERROR ${step}: ${(result.stderr || result.error || '').toString().trim().split('\n')[0]}`,
  )
  process.exit(2)
}

const baseRef = process.argv[2] || 'origin/main'
const mergeBase = run('git', ['merge-base', 'HEAD', baseRef])
if (mergeBase.status !== 0) crash('git merge-base', mergeBase)

const diff = run('git', [
  'diff',
  '--name-only',
  '--diff-filter=ACMR',
  mergeBase.stdout.trim(),
  'HEAD',
])
if (diff.status !== 0) crash('git diff', diff)
const changed = diff.stdout.split('\n').filter((f) => f && existsSync(f))
const code = changed.filter((f) => /\.(tsx?|jsx?|mjs)$/.test(f))
if (!code.length) {
  console.log('PASS no code files changed')
  process.exit(0)
}

// 1. eslint
const lint = run('npx', ['eslint', '--format', 'json', ...code])
let lintReport
try {
  lintReport = JSON.parse(lint.stdout)
} catch {
  crash('eslint', lint)
}
const lintHits = lintReport.flatMap((f) =>
  f.messages
    .filter((m) => m.severity === 2)
    .map(
      (m) =>
        `${relative(process.cwd(), f.filePath)}:${m.line} ${m.ruleId ?? 'parse'} ${m.message}`,
    ),
)
out.push(...lintHits.map((l) => `LINT ${l}`))

// 2. jest, related tests only
const jsonFile = join(
  mkdtempSync(join(tmpdir(), 'review-checks-')),
  'jest.json',
)
const jest = run('npx', [
  'jest',
  '--findRelatedTests',
  '--passWithNoTests',
  '--json',
  `--outputFile=${jsonFile}`,
  ...code,
])
if (!existsSync(jsonFile)) crash('jest', jest)
const jestReport = JSON.parse(readFileSync(jsonFile, 'utf8'))
for (const suite of jestReport.testResults) {
  for (const t of suite.assertionResults.filter((a) => a.status === 'failed')) {
    const msg = (t.failureMessages[0] ?? '').split('\n')[0]
    out.push(
      `TEST ${relative(process.cwd(), suite.name)} > ${t.fullName}: ${msg}`,
    )
  }
  if (!suite.assertionResults.length && suite.status === 'failed') {
    out.push(
      `TEST ${relative(process.cwd(), suite.name)} suite failed to run: ${suite.message.split('\n')[0]}`,
    )
  }
}

const summary = `${lintHits.length} lint, ${jestReport.numFailedTests} failed tests, ${jestReport.numTotalTests} run, ${code.length} files`
console.log(out.length ? `FAIL ${summary}` : `PASS ${summary}`)
console.log(out.slice(0, MAX_LINES).join('\n'))
if (out.length > MAX_LINES)
  console.log(`...${out.length - MAX_LINES} more. Rerun on a narrower base.`)
process.exit(out.length ? 1 : 0)
