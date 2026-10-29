#!/usr/bin/env node
/**
 * Aligns package.json dependency ranges with the policy:
 *   - Expo SDK-managed packages: set by `expo install --fix` (~ or exact).
 *   - Everything else: caret (^), except NATIVE_EXACT.
 *   - xstate is test-only: lives in devDependencies.
 *
 * Usage:
 *   node scripts/align-dependencies.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const NATIVE_EXACT = new Set(['react-native-liquid-glassmorphism'])
const MOVE_TO_DEV = ['xstate']

execSync('npx expo install --fix', { stdio: 'inherit' })

const sdkManaged = new Set(
  Object.keys(
    JSON.parse(
      readFileSync('node_modules/expo/bundledNativeModules.json', 'utf8'),
    ),
  ),
)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

for (const name of MOVE_TO_DEV) {
  if (pkg.dependencies[name]) {
    pkg.devDependencies[name] = pkg.dependencies[name]
    delete pkg.dependencies[name]
  }
}

for (const group of [pkg.dependencies, pkg.devDependencies]) {
  for (const [name, range] of Object.entries(group)) {
    const isPlainVersion = /^\d/.test(range)
    if (isPlainVersion && !sdkManaged.has(name) && !NATIVE_EXACT.has(name)) {
      group[name] = `^${range}`
    }
  }
}

const sortKeys = (object) =>
  Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => a.localeCompare(b)),
  )
pkg.dependencies = sortKeys(pkg.dependencies)
pkg.devDependencies = sortKeys(pkg.devDependencies)

writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
execSync('npm install --no-audit --no-fund', { stdio: 'inherit' })
