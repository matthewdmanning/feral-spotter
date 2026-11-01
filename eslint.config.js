// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const globals = require('globals')

// Icons come one file per icon. The package root is a barrel that re-exports
// every icon, and Metro bundles and runs all of them (#406). Type-only imports
// are erased at build time, so they stay allowed. Shared with the boundary
// blocks below, which override this rule and must repeat these paths.
const RESTRICTED_PATHS = [
  {
    name: 'phosphor-react-native',
    message:
      "Import each icon from 'phosphor-react-native/src/icons/<Name>'. The package root loads every icon.",
    allowTypeImports: true,
  },
  {
    name: 'lucide-react-native',
    message:
      "Replaced by phosphor-react-native (#406). Import from 'phosphor-react-native/src/icons/<Name>'.",
  },
]

// Feature-folder boundaries (docs/PROJECT_STRUCTURE.md). Non-screen code in a
// unit may import its own unit or a lower level only; peers on one level may
// not import each other. Screens are the composition layer and are exempt.
const BOUNDARY_LEVELS = [
  ['shared'],
  ['auth'],
  ['permissions'],
  ['core'],
  ['settings'],
  ['draft-submission'],
  ['camera-control', 'library-picker', 'annotate'],
  ['history'],
]
const unitDir = (unit) =>
  unit === 'shared' || unit === 'core' ? `src/${unit}` : `src/features/${unit}`
const boundaryBlocks = BOUNDARY_LEVELS.flatMap((level, i) =>
  level.map((unit) => {
    const forbidden = BOUNDARY_LEVELS.slice(i)
      .flat()
      .filter((other) => other !== unit)
    return {
      files: [`${unitDir(unit)}/**/*.ts`, `${unitDir(unit)}/**/*.tsx`],
      ignores: ['**/__tests__/**', '**/screens/**'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            paths: RESTRICTED_PATHS,
            patterns: [
              ...(forbidden.length
                ? [
                    {
                      group: forbidden.map((other) => `@/${unitDir(other)}/**`),
                      message: `${unit} may import only lower levels (docs/PROJECT_STRUCTURE.md). Move the shared piece down, or compose in a screen.`,
                    },
                  ]
                : []),
              {
                group: ['**/screens/**'],
                message:
                  'Only src/app routes and other screens import screens. Move the shared piece out of screens/.',
              },
            ],
          },
        ],
      },
    }
  }),
)

module.exports = defineConfig([
  expoConfig,
  // Global ignores. `.claude/worktrees` holds nested git worktrees (duplicate
  // copies of the repo); linting them is redundant and slow. ESLint flat config
  // does not read .gitignore, so ignore them explicitly.
  {
    ignores: ['dist/*', '.claude/**', 'ts-ailiot/**', 'functions/**'],
  },
  {
    files: ['babel.config.js'],
    ignores: ['dist/*'],
  },
  // eslint-config-expo 58 no longer declares these globals for plain JS:
  // Node for config files and plugins, Jest for manual mocks and setup.
  {
    files: ['*.config.js', 'jest.setup.js', 'plugins/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['__mocks__/**/*.js', 'jest.setup.js'],
    languageOptions: { globals: globals.jest },
  },
  // Google TypeScript Style Guide rules that ESLint can express without
  // type-aware linting. See docs/COMBINED_STYLE_GUIDE.md. Scoped to TS/TSX so
  // JS config files (which use CommonJS/`require`) are unaffected.
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/__tests__/**'],
    languageOptions: {
      parserOptions: {
        // Enable type-aware linting so rules that need type information can run
        // (consistent-type-exports below). projectService uses the nearest
        // tsconfig.json and falls back to a default project for files outside it.
        // `+api.ts` server routes are excluded from tsconfig.json (see
        // tsconfig.server.json / issue #56 — react-native's ambient FormData
        // type clashes with DOM lib in a shared program), so point those at
        // the server tsconfig explicitly.
        projectService: {
          allowDefaultProject: ['src/app/*+api.ts'],
          defaultProject: './tsconfig.server.json',
        },
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Use `const` and `let`; `no-var` is already error via expo config.
      'prefer-const': 'error',
      // Do not use the `Array` constructor.
      '@typescript-eslint/no-array-constructor': 'error',
      // Do not instantiate primitive wrappers (new String/Number/Boolean).
      'no-new-wrappers': 'error',
      // Do not use dynamic code evaluation.
      'no-eval': 'error',
      'no-new-func': 'error',
      // Do not modify built-ins (prototype manipulation).
      'no-proto': 'error',
      // Remove debugger statements from production code.
      'no-debugger': 'error',
      // Avoid assignments in conditions; allow when wrapped in extra parens.
      'no-cond-assign': ['error', 'except-parens'],
      // Use strict equality; `== null` / `!= null` remain allowed.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Make switch statements exhaustive in structure: require a default group.
      'default-case': 'error',
      // Avoid `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      // Avoid unsafe assertions: non-null assertion operator (`value!`).
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Annotate object literals instead of asserting them. Angle-bracket
      // assertions are already banned by expo's `consistent-type-assertions`
      // (assertionStyle: "as"); this override forbids `{...} as T` literals too.
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      // Use type-only imports and exports (consistent-type-exports is
      // type-aware; enabled by projectService above).
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      // Prefer interfaces for object shapes.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      // Use ES modules; do not use namespaces.
      '@typescript-eslint/no-namespace': 'error',
      // Do not suppress compiler errors broadly (@ts-ignore/@ts-nocheck/etc.).
      '@typescript-eslint/ban-ts-comment': 'error',
      // Icons come one file per icon. The package root is a barrel that
      // re-exports every icon, and Metro bundles and runs all of them (#406).
      // Type-only imports are erased at build time, so they stay allowed.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: RESTRICTED_PATHS,
        },
      ],
      // Do not use `#private` fields; do not use `const enum`.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(PropertyDefinition, MethodDefinition) > PrivateIdentifier.key',
          message:
            'Use the `private` modifier instead of ECMAScript `#private` fields.',
        },
        {
          selector: 'TSEnumDeclaration[const=true]',
          message: 'Do not use `const enum`; use a regular `enum`.',
        },
      ],
    },
  },
  // react-hooks/immutability flags Reanimated SharedValue `.value` mutations as illegal.
  // SharedValues are intentionally mutable from the JS thread; this is a known
  // React Compiler / Reanimated incompatibility.
  {
    files: [
      'src/features/annotate/hooks/useBoundingBoxFrame.ts',
      'src/features/camera-control/hooks/useCapturedPhotoWorkflow.tsx',
      'src/features/camera-control/screens/camera/CameraChrome.tsx',
    ],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
  ...boundaryBlocks,
  // No module-level import cycles. The TypeScript resolver follows the @/ alias.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['**/__tests__/**'],
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'import/no-cycle': ['error', { ignoreExternal: true }],
    },
  },
])
