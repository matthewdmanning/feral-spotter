#!/usr/bin/env node
/**
 * scripts/move-module.mjs
 * Moves files with `git mv` and rewrites every module specifier that pointed
 * at them: import/export, dynamic import, require, and jest.mock-family calls.
 *
 * Usage: node scripts/move-module.mjs <mapping-file> [--dry-run]
 *
 * Mapping file: one `from to` pair per line, repo-relative; `#` starts a
 * comment.
 * - Directory `from`: every tracked file under it moves, keeping its subpath.
 * - File `from`: the file moves, plus its companions — siblings named
 *   `<base>.*` (styles, constants) and `__tests__/<base>.*` (its tests).
 *   A `to` ending in `/` keeps the file name; otherwise it renames the base.
 * File entries win over directory entries.
 *
 * Exits non-zero, before moving anything, if a rewritten specifier would not
 * resolve, and after moving if any specifier newly fails to resolve.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
const SCAN = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP = /^(node_modules|functions|docs|android|ios|\.claude)\//
const SPEC =
  /(\b(?:from|import|require|mock|doMock|unmock|requireActual|requireMock|setMock|createMockFromModule)\s*\(?\s*)(['"])([^'"\n]+)\2/g

const [mappingFile, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!mappingFile) {
  console.error('usage: node scripts/move-module.mjs <mapping-file> [--dry-run]')
  process.exit(2)
}

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
const tracked = git('ls-files', '-z').split('\0').filter(Boolean)
const trackedSet = new Set(tracked)

// ---- 1. Expand the mapping into file → file moves -------------------------

const entries = fs
  .readFileSync(mappingFile, 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*/, '').trim())
  .filter(Boolean)
  .map((l) => l.split(/\s+/))

const moves = new Map()
const claim = (from, to) => {
  if (moves.has(from) && moves.get(from) !== to)
    throw new Error(`conflicting targets for ${from}`)
  moves.set(from, to)
}

for (const [from, to] of entries) {
  if (!trackedSet.has(from)) continue
  const dir = path.posix.dirname(from)
  const base = path.posix.basename(from).split('.')[0]
  const toDir = to.endsWith('/') ? to.slice(0, -1) : path.posix.dirname(to)
  const toBase = to.endsWith('/') ? base : path.posix.basename(to).split('.')[0]
  const rename = (name) => toBase + name.slice(base.length)
  for (const f of tracked) {
    const name = path.posix.basename(f)
    if (!name.startsWith(base + '.')) continue
    if (path.posix.dirname(f) === dir) claim(f, `${toDir}/${rename(name)}`)
    else if (path.posix.dirname(f) === `${dir}/__tests__`)
      claim(f, `${toDir}/__tests__/${rename(name)}`)
  }
}
for (const [from, to] of entries) {
  if (trackedSet.has(from)) continue
  const prefix = from.replace(/\/$/, '') + '/'
  const hits = tracked.filter((f) => f.startsWith(prefix))
  if (hits.length === 0) throw new Error(`nothing tracked at ${from}`)
  for (const f of hits)
    if (!moves.has(f)) claim(f, to.replace(/\/$/, '') + '/' + f.slice(prefix.length))
}
for (const to of moves.values())
  if (trackedSet.has(to) && !moves.has(to)) throw new Error(`target exists: ${to}`)

// ---- 2. Resolution against the old and new trees ---------------------------

const newTree = new Set(tracked.map((f) => moves.get(f) ?? f))

function resolve(spec, importer, tree) {
  let base
  if (spec.startsWith('@/')) base = spec.slice(2)
  else if (spec.startsWith('.'))
    base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), spec))
  else return null
  if (tree.has(base)) return { file: base, form: 'exact' }
  for (const e of EXTS) if (tree.has(base + e)) return { file: base + e, form: 'noext' }
  for (const e of EXTS)
    if (tree.has(`${base}/index${e}`)) return { file: `${base}/index${e}`, form: 'index' }
  return { file: null }
}

function newSpecifier(spec, importer, hit) {
  const target = moves.get(hit.file) ?? hit.file
  const newImporter = moves.get(importer) ?? importer
  if (target === hit.file && newImporter === importer) return spec
  let base = target
  if (hit.form !== 'exact') base = base.replace(/\.[^./]+$/, '')
  if (hit.form === 'index' && path.posix.basename(base) === 'index')
    base = path.posix.dirname(base)
  const keepRelative = spec.startsWith('.') && !newImporter.startsWith('src/')
  if (spec.startsWith('.')) {
    let rel = path.posix.relative(path.posix.dirname(newImporter), base)
    if (!rel.startsWith('.')) rel = './' + rel
    if (keepRelative || !rel.startsWith('../')) return rel
  }
  return '@/' + base
}

// ---- 3. Rewrite --------------------------------------------------------------

const scanFiles = tracked.filter((f) => SCAN.test(f) && !SKIP.test(f))
const unresolvedBefore = new Set()
const rewritten = new Map()
let changedSpecs = 0

for (const file of scanFiles) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const out = src.replace(SPEC, (all, lead, q, spec) => {
    const hit = resolve(spec, file, trackedSet)
    if (!hit) return all
    if (!hit.file) {
      unresolvedBefore.add(`${moves.get(file) ?? file} :: ${spec}`)
      return all
    }
    const next = newSpecifier(spec, file, hit)
    if (next === spec) return all
    const check = resolve(next, moves.get(file) ?? file, newTree)
    if (!check || check.file !== (moves.get(hit.file) ?? hit.file))
      throw new Error(`${file}: '${spec}' → '${next}' would not resolve`)
    changedSpecs++
    return lead + q + next + q
  })
  if (out !== src) rewritten.set(file, out)
}

console.log(
  `${moves.size} files to move; ${changedSpecs} specifiers in ${rewritten.size} files to rewrite`,
)
if (dryRun) {
  for (const [f, t] of moves) console.log(`  ${f} → ${t}`)
  process.exit(0)
}

// ---- 4. Apply: move, then write rewritten contents at the new path ----------

for (const [from, to] of moves) {
  fs.mkdirSync(path.join(ROOT, path.posix.dirname(to)), { recursive: true })
  git('mv', from, to)
}
for (const [file, contents] of rewritten)
  fs.writeFileSync(path.join(ROOT, moves.get(file) ?? file), contents)

// Drop source directories the moves left empty.
for (const from of moves.keys()) {
  let dir = path.posix.dirname(from)
  while (dir !== '.' && fs.existsSync(path.join(ROOT, dir))) {
    if (fs.readdirSync(path.join(ROOT, dir)).length) break
    fs.rmdirSync(path.join(ROOT, dir))
    dir = path.posix.dirname(dir)
  }
}

// ---- 5. Verify: no specifier newly fails to resolve -------------------------

const failures = []
for (const file of [...newTree].filter((f) => SCAN.test(f) && !SKIP.test(f))) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
  for (const m of src.matchAll(SPEC)) {
    const hit = resolve(m[3], file, newTree)
    if (hit && !hit.file && !unresolvedBefore.has(`${file} :: ${m[3]}`))
      failures.push(`${file} :: ${m[3]}`)
  }
}
if (failures.length) {
  console.error('Unresolved after move:\n  ' + failures.join('\n  '))
  process.exit(1)
}
console.log('moved and verified')
