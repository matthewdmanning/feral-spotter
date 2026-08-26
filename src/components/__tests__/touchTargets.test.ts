/**
 * Touch-target floor across every interactive element in the app.
 *
 * The failure this catches is not a regression in the buttons fixed today — it
 * is the next button. An undersized target is invisible in review (a 40dp box
 * and a 48dp box look nearly identical), ships without complaint, and surfaces
 * only as misclicks that nobody reports as a bug. So this reads the real
 * styles rather than asserting a list of numbers back at itself: add a
 * Pressable tomorrow with a 40dp box and no hitSlop, and this fails.
 *
 * The floor is 48dp, from ux_principles.md #1 — Android Material's minimum.
 * The Apple HIG's 44pt is lower, and the app ships to Android first.
 *
 * Only styles that declare a vertical size are checked. A Pressable that wraps
 * an already-sized child (an AppButton, say) contributes no size of its own,
 * and asserting against it would flag the wrapper for its child's dimensions.
 */

import fs from 'fs'
import path from 'path'

const SRC = path.join(__dirname, '..', '..')
const TOUCH_TARGET_MIN_DP = 48

/** Every .tsx and .styles.ts under src/, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(full, out)
    } else if (
      entry.name.endsWith('.tsx') ||
      entry.name.endsWith('.styles.ts')
    ) {
      out.push(full)
    }
  }
  return out
}

/** Read a file, normalising the CRLF endings these are checked in with. */
function read(file: string): string {
  return fs.readFileSync(file, 'utf8').split('\r\n').join('\n')
}

/** Style key -> declaration body, for one .styles.ts file. */
function parseStyles(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const txt = read(file)
  const out: Record<string, string> = {}
  // Entries are written either expanded across lines or as a single line, and
  // the older files column-align the values, so the colon may be followed by
  // several spaces. Matching only a single space silently skipped whole files.
  const expanded = /^ {2}([A-Za-z0-9_]+): +\{\n([\s\S]*?)^ {2}\},?$/gm
  const inline = /^ {2}([A-Za-z0-9_]+): +\{([^\n}]*)\},?$/gm
  for (const re of [expanded, inline]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(txt))) out[m[1]] ??= m[2]
  }
  return out
}

/** Vertical size a style pins, or null when it leaves height to its content. */
function declaredHeight(body: string): number | null {
  const m = /\b(?:minHeight|height): (\d+)/.exec(body)
  return m ? Number(m[1]) : null
}

interface SizedTarget {
  styleKey: string
  line: number
  height: number
}

/** Sizes pinned by Pressables in one screen that do not extend area via hitSlop. */
function sizedPressableStyles(file: string): SizedTarget[] {
  const txt = read(file)
  const styles = parseStyles(file.replace(/\.tsx$/, '.styles.ts'))
  const found: SizedTarget[] = []

  const pressable =
    /<(?:Pressable|TouchableOpacity|TouchableHighlight)\b([\s\S]*?)(?:\/>|>)/g
  let m: RegExpExecArray | null
  while ((m = pressable.exec(txt))) {
    const attrs = m[1]
    // hitSlop extends the touch area past the box, which is the other valid way
    // to clear the floor — and the right one where growing the box would shift
    // whatever sits beside it.
    if (attrs.includes('hitSlop')) continue

    const line = txt.slice(0, m.index).split('\n').length
    for (const ref of attrs.match(/styles\.([A-Za-z0-9_]+)/g) ?? []) {
      const styleKey = ref.replace('styles.', '')
      const height = declaredHeight(styles[styleKey] ?? '')
      if (height !== null) found.push({ styleKey, line, height })
    }
  }
  return found
}

const screens = sourceFiles(SRC).filter((f) => f.endsWith('.tsx'))

describe('touch targets', () => {
  it('never renders an interactive element below the 48dp floor', () => {
    const undersized = screens.flatMap((file) =>
      sizedPressableStyles(file)
        .filter((t) => t.height < TOUCH_TARGET_MIN_DP)
        .map((t) => {
          const rel = path.relative(SRC, file).replace(/\\/g, '/')
          return `${rel}:${t.line} — styles.${t.styleKey} is ${t.height}dp`
        }),
    )

    expect(undersized).toEqual([])
  })

  it('actually inspects the codebase, rather than passing on an empty scan', () => {
    // This caught a real defect on its first run: the parser matched against \n
    // while the files are checked in with CRLF, so it found nothing and made the
    // check above pass vacuously. Without this assertion that failure is silent.
    const inspected = screens.flatMap(sizedPressableStyles)

    expect(inspected.length).toBeGreaterThan(10)
  })
})
