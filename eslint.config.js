// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  // Global ignores. `.claude/worktrees` holds nested git worktrees (duplicate
  // copies of the repo); linting them is redundant and slow. ESLint flat config
  // does not read .gitignore, so ignore them explicitly.
  {
    ignores: ["dist/*", ".claude/**"],
  },
  {
    files: ["babel.config.js"],
    ignores: ["dist/*"],
  },
  // Google TypeScript Style Guide rules that ESLint can express without
  // type-aware linting. See docs/COMBINED_STYLE_GUIDE.md. Scoped to TS/TSX so
  // JS config files (which use CommonJS/`require`) are unaffected.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/__tests__/**"],
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
          allowDefaultProject: ["src/app/*+api.ts"],
          defaultProject: "./tsconfig.server.json",
        },
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Use `const` and `let`; `no-var` is already error via expo config.
      "prefer-const": "error",
      // Do not use the `Array` constructor.
      "@typescript-eslint/no-array-constructor": "error",
      // Do not instantiate primitive wrappers (new String/Number/Boolean).
      "no-new-wrappers": "error",
      // Do not use dynamic code evaluation.
      "no-eval": "error",
      "no-new-func": "error",
      // Do not modify built-ins (prototype manipulation).
      "no-proto": "error",
      // Remove debugger statements from production code.
      "no-debugger": "error",
      // Avoid assignments in conditions; allow when wrapped in extra parens.
      "no-cond-assign": ["error", "except-parens"],
      // Use strict equality; `== null` / `!= null` remain allowed.
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Make switch statements exhaustive in structure: require a default group.
      "default-case": "error",
      // Avoid `any`.
      "@typescript-eslint/no-explicit-any": "error",
      // Avoid unsafe assertions: non-null assertion operator (`value!`).
      "@typescript-eslint/no-non-null-assertion": "error",
      // Annotate object literals instead of asserting them. Angle-bracket
      // assertions are already banned by expo's `consistent-type-assertions`
      // (assertionStyle: "as"); this override forbids `{...} as T` literals too.
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      // Use type-only imports and exports (consistent-type-exports is
      // type-aware; enabled by projectService above).
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-exports": "error",
      // Prefer interfaces for object shapes.
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      // Use ES modules; do not use namespaces.
      "@typescript-eslint/no-namespace": "error",
      // Do not suppress compiler errors broadly (@ts-ignore/@ts-nocheck/etc.).
      "@typescript-eslint/ban-ts-comment": "error",
      // Do not use `#private` fields; do not use `const enum`.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ':matches(PropertyDefinition, MethodDefinition) > PrivateIdentifier.key',
          message:
            "Use the `private` modifier instead of ECMAScript `#private` fields.",
        },
        {
          selector: "TSEnumDeclaration[const=true]",
          message: "Do not use `const enum`; use a regular `enum`.",
        },
      ],
    },
  },
  // react-hooks/immutability flags Reanimated SharedValue `.value` mutations as illegal.
  // SharedValues are intentionally mutable from the JS thread; this is a known
  // React Compiler / Reanimated incompatibility.
  {
    files: [
      "src/hooks/useBoundingBoxFrame.ts",
      "src/hooks/useCameraCapture.tsx",
      "src/screens/camera/index.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);
