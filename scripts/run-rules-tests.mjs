/**
 * scripts/run-rules-tests.mjs
 * Runs the Firestore/Storage rules suite against the Firebase emulators.
 *
 * Exists only to hand firebase-tools a JDK it accepts. firebase-tools requires
 * Java 21+, but this machine's PATH resolves `java` to a JDK 17 install that
 * Gradle deliberately keeps (see the Kotlin-daemon notes) — and firebase-tools
 * picks java off PATH, not JAVA_HOME, so exporting JAVA_HOME alone does
 * nothing. This prepends a 21+ JDK's bin to PATH for this command only,
 * leaving the global JAVA_HOME/PATH that the Android build depends on alone.
 *
 * Override with RULES_TEST_JAVA_HOME if your JDK lives elsewhere.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const JAVA_ROOTS = ['C:/Program Files/Java', 'C:/Program Files/Eclipse Adoptium']
const MIN_MAJOR = 21

/** Highest installed JDK at or above MIN_MAJOR, or null. */
function findJavaHome() {
  const override = process.env.RULES_TEST_JAVA_HOME
  if (override) return override

  const candidates = JAVA_ROOTS.filter(existsSync).flatMap((root) =>
    readdirSync(root)
      .map((name) => ({ path: join(root, name), major: Number(/(\d+)/.exec(name)?.[1]) }))
      .filter(({ path, major }) => major >= MIN_MAJOR && existsSync(join(path, 'bin', 'java.exe'))),
  )
  return candidates.sort((a, b) => b.major - a.major)[0]?.path ?? null
}

const javaHome = findJavaHome()
if (!javaHome) {
  console.error(
    `No JDK ${MIN_MAJOR}+ found under ${JAVA_ROOTS.join(' or ')}.\n` +
      'firebase-tools needs one to start the emulators. Install a JDK 21+ or set\n' +
      'RULES_TEST_JAVA_HOME to an existing install.',
  )
  process.exit(1)
}

const { status } = spawnSync(
  'npx',
  [
    'firebase',
    'emulators:exec',
    '--project',
    'project-e3d5659d-bc4f-438f-88c',
    '--only',
    'firestore,storage,auth',
    // Quoted explicitly: with shell:true the spawn does no quoting of its own,
    // so an unquoted string here reaches firebase as separate argv entries.
    '"jest -c jest.rules.config.js --runInBand"',
  ],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      PATH: `${join(javaHome, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    },
  },
)

process.exit(status ?? 1)
