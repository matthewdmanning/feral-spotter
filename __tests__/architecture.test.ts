import { execFileSync } from 'node:child_process'

const shared = 'src/shared/utils/maskEmail.ts'
const feature = 'src/features/draft-submission/hooks/useCatForm.ts'
const organization = 'src/features/organizations/lib/consent.ts'
const screen = 'src/features/draft-submission/screens/create/index.tsx'
const workflow = 'src/workflows/photo-entry/hooks/usePhotoEntrypoints.ts'
const provider = 'src/providers/AppProviders.tsx'
const route = 'src/app/_layout.tsx'

const cases = [
  [
    'organizations can import the shared Submission store',
    organization,
    '@/src/shared/hooks/useSubmissionStore',
    false,
  ],
  [
    'draft features can import the shared Submission store',
    feature,
    '@/src/shared/hooks/useSubmissionStore',
    false,
  ],
  [
    'shared cannot import a feature Submission store',
    shared,
    '@/src/features/draft-submission/hooks/useSubmissionStore',
    true,
  ],
  ['shared cannot import routes', shared, '@/src/app/consent', true],
  [
    'shared cannot import providers',
    shared,
    '@/src/providers/AppProviders',
    true,
  ],
  ['features cannot import routes', feature, '@/src/app/consent', true],
  [
    'features cannot import providers',
    feature,
    '@/src/providers/AppProviders',
    true,
  ],
  ['workflows cannot import routes', workflow, '@/src/app/consent', true],
  [
    'workflows cannot import providers',
    workflow,
    '@/src/providers/AppProviders',
    true,
  ],
  ['screens cannot import routes', screen, '@/src/app/consent', true],
  [
    'screens cannot import providers',
    screen,
    '@/src/providers/AppProviders',
    true,
  ],
  ['providers cannot import routes', provider, '@/src/app/consent', true],
  [
    'providers cannot import screens',
    provider,
    '@/src/features/permissions/screens/consent',
    true,
  ],
  [
    'workflows cannot import screens',
    workflow,
    '@/src/features/permissions/screens/consent',
    true,
  ],
  [
    'shared cannot import auth',
    shared,
    '@/src/features/auth/lib/authStore',
    true,
  ],
  [
    'features cannot import workflows',
    feature,
    '@/src/workflows/photo-entry/hooks/usePhotoEntrypoints',
    true,
  ],
  [
    'camera cannot import its library peer',
    'src/features/camera-control/hooks/useCameraCapture.tsx',
    '@/src/features/library-picker/hooks/useLibraryPhotoPicker',
    true,
  ],
  [
    'upward imports of directory roots are forbidden',
    shared,
    '@/src/features/auth',
    true,
  ],
  [
    'parent-relative imports are forbidden',
    feature,
    '../../../shared/utils/maskEmail',
    true,
  ],
  [
    'screens can compose workflows',
    screen,
    '@/src/workflows/photo-entry/hooks/usePhotoEntrypoints',
    false,
  ],
  [
    'screens can compose other screens',
    screen,
    '@/src/features/permissions/screens/consent',
    false,
  ],
  [
    'workflows can compose features',
    workflow,
    '@/src/features/library-picker/hooks/useLibraryPhotoPicker',
    false,
  ],
  [
    'features can import shared modules',
    feature,
    '@/src/shared/utils/maskEmail',
    false,
  ],
  [
    'providers can compose features',
    provider,
    '@/src/features/organizations/components/OrganizationsRuntime',
    false,
  ],
  [
    'routes can compose providers',
    route,
    '@/src/providers/AppProviders',
    false,
  ],
  [
    'routes can import screens',
    route,
    '@/src/features/permissions/screens/consent',
    false,
  ],
] as const

let results: { label: string; restricted: boolean; fatal: boolean }[]

beforeAll(() => {
  // ESLint runs in plain Node against the real config, outside Jest's RN
  // transforms. Disable type information only: these fixtures exercise import
  // policy, and do not need files added to the TypeScript project on disk.
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { ESLint } from 'eslint'
    import { readFileSync } from 'node:fs'
    const cases = JSON.parse(readFileSync(0, 'utf8'))
    const eslint = new ESLint({ overrideConfig: {
      languageOptions: { parserOptions: { projectService: false } },
      rules: { '@typescript-eslint/consistent-type-exports': 'off' },
    } })
    const results = []
    for (const [label, filePath, target] of cases) {
      const [result] = await eslint.lintText(
        'export * from ' + JSON.stringify(target), { filePath },
      )
      results.push({ label,
        restricted: result.messages.some(m => m.ruleId === '@typescript-eslint/no-restricted-imports'),
        fatal: result.messages.some(m => m.fatal),
      })
    }
    process.stdout.write(JSON.stringify(results))
  `,
    ],
    { input: JSON.stringify(cases), encoding: 'utf8' },
  )
  results = JSON.parse(output)
}, 60_000)

test.each(cases)('%s', (label, _file, _target, restricted) => {
  expect(results.find((result) => result.label === label)).toEqual({
    label,
    restricted,
    fatal: false,
  })
})
