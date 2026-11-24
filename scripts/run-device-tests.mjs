/** Runs the Android Maestro suites against a fresh Firebase Emulator Suite. */
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const functionsRequire = createRequire(
  new URL('../functions/package.json', import.meta.url),
)
const {
  expo: { android },
} = require('../app.json')
const { emulators } = require('../firebase.json')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  })
  if (result.error?.code === 'ENOENT' && ['adb', 'maestro'].includes(command)) {
    throw new Error(`Install ${command} and put it on PATH.`)
  }
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args[0]} failed (${result.signal ?? result.status})`,
    )
  }
  return result.stdout?.trim()
}

function deviceCommand(serial, args, options) {
  return run('adb', ['-s', serial, ...args], options)
}

function selectDevice() {
  const output = run('adb', ['devices'], { encoding: 'utf8', stdio: 'pipe' })
  const devices = output
    .split(/\r?\n/)
    .map((line) => /^(\S+)\s+device$/.exec(line)?.[1])
    .filter(Boolean)
  const serial =
    process.env.ANDROID_SERIAL ??
    (devices.length === 1 ? devices[0] : undefined)
  if (!devices.includes(serial)) {
    throw new Error(
      'Connect and authorize one Android device, or select one with ANDROID_SERIAL.',
    )
  }
  const qemu = deviceCommand(serial, ['shell', 'getprop', 'ro.kernel.qemu'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  if (serial.startsWith('emulator-') || qemu === '1') {
    throw new Error('The device suites require a physical Android device.')
  }
  const apk = deviceCommand(serial, ['shell', 'pm', 'path', android.package], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  if (!apk?.startsWith('package:')) {
    throw new Error(
      'Install the standalone Android emulator-backend build first.',
    )
  }
  return serial
}

async function verifySubmission(adminApp, uid) {
  const { getStorage } = functionsRequire('firebase-admin/storage')
  const [files] = await getStorage(adminApp)
    .bucket()
    .getFiles({
      prefix: `submissions/${uid}/`,
    })
  const names = new Set(
    files
      .filter((file) => Number(file.metadata.size) > 0)
      .map((file) => file.name),
  )
  const metadata = [...names].find((name) => name.endsWith('/metadata.json'))
  if (
    !metadata ||
    !names.has(metadata.replace(/metadata\.json$/, 'photo-0.jpg'))
  ) {
    throw new Error(
      'Storage emulator is missing metadata.json or photo-0.jpg for the same Submission.',
    )
  }
  console.log(
    'Storage emulator contains metadata.json and photo-0.jpg for the same Submission.',
  )
}

async function runWithEmulators() {
  const {
    DEVICE_TEST_SERIAL: serial,
    DEVICE_TEST_SUITE: suite,
    GCLOUD_PROJECT: projectId,
  } = process.env
  for (const [name, port] of [
    ['FIREBASE_AUTH_EMULATOR_HOST', emulators.auth.port],
    ['FIREBASE_STORAGE_EMULATOR_HOST', emulators.storage.port],
  ]) {
    if (
      process.env[name] !== `127.0.0.1:${port}` &&
      process.env[name] !== `localhost:${port}`
    ) {
      throw new Error(
        `Run through npm run test:device with the local ${name} configured.`,
      )
    }
  }
  if (!serial || !projectId || !['smoke', 'cat-form'].includes(suite)) {
    throw new Error('Run through npm run test:device.')
  }
  const { project_info: project } = require('../google-services.json')
  if (projectId !== project.project_id || !project.storage_bucket) {
    throw new Error(
      'The active Firebase emulator project must match google-services.json.',
    )
  }
  // Use only the host validated above, even if STORAGE_EMULATOR_HOST was exported.
  process.env.STORAGE_EMULATOR_HOST = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
  const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app')
  const { getAuth } = functionsRequire('firebase-admin/auth')
  const adminApp = initializeApp({
    projectId,
    storageBucket: project.storage_bucket,
  })
  const addedTunnels = []
  try {
    const existing = deviceCommand(serial, ['reverse', '--list'], {
      encoding: 'utf8',
      stdio: 'pipe',
    })
    for (const { port } of [
      emulators.auth,
      emulators.storage,
      emulators.functions,
    ]) {
      const endpoint = `tcp:${port}`
      const mapping = existing
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .find((fields) => fields.at(-2) === endpoint)
      if (mapping?.at(-1) === endpoint) continue
      deviceCommand(serial, ['reverse', '--no-rebind', endpoint, endpoint])
      addedTunnels.push(endpoint)
    }
    for (const tag of ['FirebaseStorage', 'FirebaseAuth', 'FirebaseApp']) {
      deviceCommand(serial, ['shell', 'setprop', `log.tag.${tag}`, 'DEBUG'])
    }
    const password = randomBytes(16).toString('hex')
    const email = `maestro-${randomBytes(8).toString('hex')}@example.test`
    const { uid } = await getAuth(adminApp).createUser({
      email,
      password,
      emailVerified: true,
    })
    run('maestro', [
      '--device',
      serial,
      'test',
      '.maestro',
      '--include-tags',
      suite,
      '-e',
      `DEVICE_TEST_EMAIL=${email}`,
      '-e',
      `DEVICE_TEST_PASSWORD=${password}`,
    ])
    if (suite === 'smoke') await verifySubmission(adminApp, uid)
  } finally {
    for (const endpoint of addedTunnels) {
      const result = spawnSync('adb', [
        '-s',
        serial,
        'reverse',
        '--remove',
        endpoint,
      ])
      if (result.status !== 0)
        console.warn(`Could not remove adb reverse tunnel ${endpoint}.`)
    }
    await deleteApp(adminApp)
  }
}

try {
  const [suite = 'smoke', ...extra] = process.argv.slice(2)
  if (suite === '--with-emulators') {
    await runWithEmulators()
  } else {
    if (extra.length || !['smoke', 'cat-form'].includes(suite)) {
      throw new Error('Usage: npm run test:device -- [smoke|cat-form]')
    }
    const serial = selectDevice()
    run('maestro', ['--version'])
    // Parse up front, before starting the backend or clearing app state.
    const { project_info: project } = require('../google-services.json')
    if (!project?.project_id || !project.storage_bucket) {
      throw new Error(
        'google-services.json must specify the Firebase project and Storage bucket.',
      )
    }
    run(process.execPath, ['scripts/run-rules-tests.mjs', '--device'], {
      env: {
        ...process.env,
        DEVICE_TEST_SERIAL: serial,
        DEVICE_TEST_SUITE: suite,
        DEVICE_TEST_PROJECT: project.project_id,
      },
    })
  }
} catch (error) {
  console.error(`[test:device] ${error.message}`)
  process.exitCode = 1
}
