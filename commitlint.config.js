const IMPORTED_DOCS_SUBJECTS = new Set([
  'docs-agents-route-templates',
  'docs(implementations): Continue Observation note, circle-buttons extension',
  'revert: undo the UI/UX docs move from PR #26',
  'docs(agents): add Firebase debug logging to test drives and fix a template path',
  'docs(domain): record how the tutorial status is stored',
  'ci: check changed Markdown and YAML with prettier on pull requests',
  'Merge issue-339-burn-down-handoff: make the handoff deletion a real ancestor',
])

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'refactor',
        'test',
        'docs',
        'ci',
        'build',
        'perf',
        'style',
      ],
    ],
  },
  // GitHub squash-merges a nested PR's subject verbatim from the PR title
  // (see docs/agents/git.md lesson #1) — a trailing "(#NNN) (#NNN)" is that
  // subject's signature and isn't hand-authored, so don't case-lint it.
  ignores: [
    (message) => /\(#\d+\)\s*\(#\d+\)$/.test(message.split('\n')[0]),
    // Commits imported with the former feral-spotter-docs history. That repo
    // never ran commitlint, and rewriting history would break the import.
    (message) => IMPORTED_DOCS_SUBJECTS.has(message.split('\n')[0].trim()),
  ],
}
