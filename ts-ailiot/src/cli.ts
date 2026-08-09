import { statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Which filesystem settings the agent is allowed to load in the target repo.
 *
 * The SDK loads user, project, and local settings by default, which means an
 * agent pointed at a repo silently inherits that repo's `.claude/` hooks,
 * skills, plugins, and memory. That is rarely what a headless ticket
 * implementer wants, so the choice is explicit and defaults to `none`.
 */
export type SettingsScope = "none" | "project" | "all";

export interface AgentRunConfiguration {
  /** GitHub issue number to implement. */
  issueNumber: number;
  /** `owner/name`, or undefined to use the repo that `--cwd` belongs to. */
  repository: string | undefined;
  /** Absolute path to the repo the agent edits. Never defaults. */
  workingDirectory: string;
  /** Model alias or full name; undefined uses the SDK default. */
  model: string | undefined;
  settingsScope: SettingsScope;
  /** Print the resolved ticket, prompt, and options without calling Claude. */
  dryRun: boolean;
}

export const CLI_USAGE = `ts-ailiot - implement a GitHub ticket with the Claude Agent SDK

Usage:
  npm start -- <issue-number> --cwd <path-to-repo> [options]

Required:
  <issue-number>          Issue to implement, e.g. 210
  --cwd <path>            Repo the agent may read and edit

Options:
  --repo <owner/name>     Repo to read the issue from (default: the one at --cwd)
  --model <name>          Model alias or full name (default: SDK default)
  --settings <scope>      none | project | all  (default: none)
  --dry-run               Print the ticket, prompt, and options, then exit
  -h, --help              Show this message

Set ANTHROPIC_API_KEY in the environment first; the SDK does not read .env files.`;

class CliArgumentError extends Error {}

function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) {
    throw new CliArgumentError(`${flag} requires a value`);
  }
  return value;
}

function parseSettingsScope(value: string): SettingsScope {
  if (value === "none" || value === "project" || value === "all") {
    return value;
  }
  throw new CliArgumentError(
    `--settings must be one of none | project | all (got "${value}")`,
  );
}

function resolveExistingDirectory(path: string): string {
  const absolutePath = resolve(path);
  let isDirectory = false;
  try {
    isDirectory = statSync(absolutePath).isDirectory();
  } catch {
    throw new CliArgumentError(`--cwd does not exist: ${absolutePath}`);
  }
  if (!isDirectory) {
    throw new CliArgumentError(`--cwd is not a directory: ${absolutePath}`);
  }
  return absolutePath;
}

/**
 * Parses process arguments into a run configuration.
 *
 * Returns `undefined` when the user asked for help, so the caller can print
 * usage and exit cleanly rather than treating it as an error.
 *
 * @throws CliArgumentError when arguments are missing or invalid.
 */
export function parseCliArguments(
  argv: readonly string[],
): AgentRunConfiguration | undefined {
  let issueNumber: number | undefined;
  let repository: string | undefined;
  let workingDirectory: string | undefined;
  let model: string | undefined;
  let settingsScope: SettingsScope = "none";
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "-h":
      case "--help":
        return undefined;
      case "--repo":
        repository = requireValue("--repo", argv[index + 1]);
        index += 1;
        break;
      case "--cwd":
        workingDirectory = resolveExistingDirectory(
          requireValue("--cwd", argv[index + 1]),
        );
        index += 1;
        break;
      case "--model":
        model = requireValue("--model", argv[index + 1]);
        index += 1;
        break;
      case "--settings":
        settingsScope = parseSettingsScope(
          requireValue("--settings", argv[index + 1]),
        );
        index += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default: {
        if (argument === undefined || argument.startsWith("-")) {
          throw new CliArgumentError(`Unknown option: ${String(argument)}`);
        }
        const parsedNumber = Number.parseInt(argument, 10);
        if (!Number.isInteger(parsedNumber) || parsedNumber <= 0) {
          throw new CliArgumentError(`Not an issue number: ${argument}`);
        }
        issueNumber = parsedNumber;
      }
    }
  }

  if (issueNumber === undefined) {
    throw new CliArgumentError("Missing <issue-number>");
  }
  if (workingDirectory === undefined) {
    throw new CliArgumentError(
      "Missing --cwd; point it at the repo the agent should edit",
    );
  }

  return {
    issueNumber,
    repository,
    workingDirectory,
    model,
    settingsScope,
    dryRun,
  };
}

export function isCliArgumentError(error: unknown): boolean {
  return error instanceof CliArgumentError;
}
