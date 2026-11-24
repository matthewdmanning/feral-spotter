// Jest settings for code that loads the real firebase-admin runtime.
//
// firebase-admin 14 reaches ESM-only packages: jose (via jwks-rsa, with
// require()) and node-fetch (via teeny-request and gaxios, with import()).
// Jest's CommonJS runtime cannot load either form, and its VM-modules mode
// cannot require() ESM. Transpiling both the ESM packages and their
// dynamic-import callers to CommonJS satisfies both paths.
const TRANSPILED = [
  'jose',
  'node-fetch',
  'fetch-blob',
  'data-uri-to-buffer',
  'formdata-polyfill',
  'teeny-request',
  'gaxios',
]

module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  // Matches nested copies too, e.g. google-auth-library/node_modules/gaxios.
  transformIgnorePatterns: [
    `/node_modules/(?!(?:.*/node_modules/)?(?:${TRANSPILED.join('|')})/)`,
  ],
}
