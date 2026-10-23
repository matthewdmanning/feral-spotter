/** Runs rules tests against local emulators with an available Java 21+ runtime. */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const MIN_MAJOR = 21
const JAVA_ROOTS = [
  'C:/Program Files/Java',
  'C:/Program Files/Eclipse Adoptium',
]
const javaExecutable = process.platform === 'win32' ? 'java.exe' : 'java'

function supportsEmulators(command) {
  const result = spawnSync(command, ['-version'], { encoding: 'utf8' })
  const version = /version "(?:1\.)?(\d+)/.exec(
    `${result.stderr ?? ''}\n${result.stdout ?? ''}`,
  )
  return result.status === 0 && Number(version?.[1]) >= MIN_MAJOR
}

/** Preserve the Android toolchain's environment; select Java for this process only. */
function findJava() {
  const override = process.env.RULES_TEST_JAVA_HOME
  if (override) {
    if (!supportsEmulators(join(override, 'bin', javaExecutable))) {
      throw new Error(`RULES_TEST_JAVA_HOME must point to Java ${MIN_MAJOR}+`)
    }
    return { home: override }
  }

  const configured = process.env.JAVA_HOME
  if (
    configured &&
    supportsEmulators(join(configured, 'bin', javaExecutable))
  ) {
    return { home: configured }
  }
  if (supportsEmulators('java')) return {}

  const candidates = JAVA_ROOTS.filter(existsSync)
    .flatMap((root) =>
      readdirSync(root).map((name) => ({
        home: join(root, name),
        major: Number(/(\d+)/.exec(name)?.[1]),
      })),
    )
    .filter(({ major }) => major >= MIN_MAJOR)
    .sort((a, b) => b.major - a.major)
  return candidates.find(({ home }) =>
    supportsEmulators(join(home, 'bin', javaExecutable)),
  )
}

const java = findJava()
if (!java) {
  console.error(
    `Rules tests require Java ${MIN_MAJOR}+. Set JAVA_HOME or RULES_TEST_JAVA_HOME, or put it on PATH.`,
  )
  process.exit(1)
}

const pathKey =
  Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
const env = { ...process.env }
if (java.home) {
  env.JAVA_HOME = java.home
  env[pathKey] =
    `${join(java.home, 'bin')}${process.platform === 'win32' ? ';' : ':'}${env[pathKey] ?? ''}`
}

const hasProxy =
  env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy
const localProxySupport = hasProxy
  ? [
      '--import',
      fileURLToPath(
        new URL('./firebase-emulator-loopback.mjs', import.meta.url),
      ),
    ]
  : []

// Invoke the installed CLI directly: no npx download or platform-specific shell quoting.
const { status, error } = spawnSync(
  process.execPath,
  [
    ...localProxySupport,
    require.resolve('firebase-tools/lib/bin/firebase.js'),
    'emulators:exec',
    '--project',
    'project-e3d5659d-bc4f-438f-88c',
    '--only',
    'firestore,storage,auth',
    'jest -c jest.rules.config.js --runInBand',
  ],
  { stdio: 'inherit', cwd: repoRoot, env },
)
if (error) console.error(error.message)
process.exit(status ?? 1)
