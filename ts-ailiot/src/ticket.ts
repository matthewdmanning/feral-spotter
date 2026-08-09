import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const runCommand = promisify(execFile)

export interface GitHubTicket {
  number: number
  title: string
  body: string
  labels: string[]
  url: string
}

interface GitHubIssuePayload {
  number: number
  title: string
  body: string | null
  labels: { name: string }[]
  url: string
}

/**
 * Reads a GitHub issue through the `gh` CLI.
 *
 * `gh` is used instead of an HTTP client so the caller's existing `gh auth`
 * credentials and enterprise host config apply with no extra setup.
 *
 * @param issueNumber Issue to read.
 * @param workingDirectory Directory to run `gh` in; determines the default repo.
 * @param repository Optional `owner/name` override.
 */
export async function fetchGitHubTicket(
  issueNumber: number,
  workingDirectory: string,
  repository?: string,
): Promise<GitHubTicket> {
  const commandArguments = [
    'issue',
    'view',
    String(issueNumber),
    '--json',
    'number,title,body,labels,url',
  ]
  if (repository !== undefined) {
    commandArguments.push('--repo', repository)
  }

  let stdout: string
  try {
    ;({ stdout } = await runCommand('gh', commandArguments, {
      cwd: workingDirectory,
      windowsHide: true,
    }))
  } catch (error) {
    throw new Error(
      `Could not read issue #${issueNumber} via gh. Check that gh is installed, ` +
        `authenticated (\`gh auth status\`), and that the issue exists.\n${String(error)}`,
    )
  }

  const payload = JSON.parse(stdout) as GitHubIssuePayload
  return {
    number: payload.number,
    title: payload.title,
    body: payload.body ?? '',
    labels: payload.labels.map((label) => label.name),
    url: payload.url,
  }
}

/** Renders a ticket as the task description handed to the agent. */
export function formatTicketForPrompt(ticket: GitHubTicket): string {
  const labelLine =
    ticket.labels.length > 0
      ? `Labels: ${ticket.labels.join(', ')}`
      : 'Labels: none'
  return [
    `Issue #${ticket.number}: ${ticket.title}`,
    ticket.url,
    labelLine,
    '',
    ticket.body.trim() || '(no description provided)',
  ].join('\n')
}
