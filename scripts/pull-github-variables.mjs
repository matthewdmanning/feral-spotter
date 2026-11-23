import { execFileSync } from 'node:child_process'
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const expoRequire = createRequire(require.resolve('expo/package.json'))
const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'))
const { parseEnvFiles } = cliRequire('@expo/env')
const repoRoot = fileURLToPath(new URL('../', import.meta.url))

function encodeVariable({ name, value }) {
  const quote = ["'", '`', '"'].find((candidate) => !value.includes(candidate))
  if (!quote) throw new Error(`Cannot represent ${name} in an Expo env file`)

  // Expo expands variable references even in quoted values.
  const escaped = value.replaceAll('$', () => '\\$')
  return `${name}=${quote}${escaped}${quote}\n`
}

function pullVariables(mode, githubEnvironment = mode) {
  if (mode !== 'development' && mode !== 'production') {
    throw new Error(
      'Usage: npm run env:pull -- <development|production> [github-environment]',
    )
  }

  const output = execFileSync(
    'gh',
    ['variable', 'list', '--env', githubEnvironment, '--json', 'name,value'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  )
  const variables = JSON.parse(output)
  const contents = variables.map(encodeVariable).join('')
  const filename = `.env.${mode}.local`
  const stagingDirectory = mkdtempSync(join(repoRoot, '.env-pull-local-'))
  try {
    const stagedFile = join(stagingDirectory, filename)
    writeFileSync(stagedFile, contents, { mode: 0o600 })

    // Use the installed Expo CLI's parser before replacing the current file.
    const { env } = parseEnvFiles([stagedFile], { systemEnv: {} })
    const changed = variables.filter(({ name, value }) => env[name] !== value)
    if (changed.length) {
      throw new Error(
        `Expo cannot read these variables verbatim: ${changed.map(({ name }) => name).join(', ')}`,
      )
    }

    renameSync(stagedFile, join(repoRoot, filename))
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true })
  }

  console.log(
    `Wrote ${variables.length} variables from ${githubEnvironment} to ${filename}`,
  )
}

try {
  pullVariables(process.argv[2], process.argv[3])
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
