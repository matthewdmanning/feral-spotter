/**
 * Shared by format-changed.mjs (pre-push, CI) and format-staged.mjs
 * (pre-commit), so every gate formats the same files with the same prettier.
 * Each gate drifted from the others before this module existed.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const SUPPORTED = /\.(tsx?|jsx?|json|md|ya?ml)$/

// Deliberately still in the older column-aligned layout — see commit 80bf6cf
// and docs/implementations/2026-08-26-issue-325-touch-targets.md. Reformatting
// them buries real edits in formatting noise; the whole-repo reformat is its
// own branch. Drop an entry once that branch lands and the file converts.
export const COLUMN_ALIGNED = new Set([
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

export const isFormattable = (file) => SUPPORTED.test(file) && !COLUMN_ALIGNED.has(file)

export const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

/**
 * Returns a function that runs the prettier package-lock.json pins — the one
 * CI installs. `npx prettier` is never used: with no node_modules (a fresh
 * worktree) it downloads whatever is newest, and that version formats
 * differently. A linked worktree falls back to the main checkout's install.
 */
export function createPrettierRunner() {
  const top = git('rev-parse', '--show-toplevel')
  const mainCheckout = resolve(top, git('rev-parse', '--git-common-dir'), '..')
  const cli = [top, mainCheckout]
    .map((root) => join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs'))
    .find(existsSync)
  if (!cli) throw new Error('prettier is not installed. Run `npm ci --legacy-peer-deps`.')

  const run = (args, options = {}) =>
    execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', ...options })

  const pinned = JSON.parse(readFileSync(join(top, 'package-lock.json'), 'utf8')).packages[
    'node_modules/prettier'
  ].version
  const installed = run(['--version']).trim()
  if (installed !== pinned) {
    throw new Error(
      `prettier ${installed} is installed but package-lock.json pins ${pinned}. Run \`npm ci --legacy-peer-deps\`.`,
    )
  }
  return run
}
