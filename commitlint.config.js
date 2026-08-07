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
  ignores: [(message) => /\(#\d+\)\s*\(#\d+\)$/.test(message.split('\n')[0])],
}
