import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options, SettingSource } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRunConfiguration, SettingsScope } from "./cli.js";
import { formatTicketForPrompt, type GitHubTicket } from "./ticket.js";

/**
 * Tools the agent may use without prompting.
 *
 * `Bash` is bare rather than scoped because the agent has to run whatever test
 * command the target repo happens to use. The deny rules below are what keep
 * that from being open season.
 */
const ALLOWED_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "Edit",
  "Write",
  "TodoWrite",
  "Bash",
];

/**
 * Shell patterns denied in every permission mode.
 *
 * Deny rules are evaluated before the permission mode, so these hold even
 * though `Bash` is auto-approved above. They cover the two things a ticket
 * implementer should never do on its own: destroy uncommitted work, and push
 * anything outward.
 */
const DESTRUCTIVE_COMMAND_DENY_RULES = [
  "Bash(rm -rf *)",
  "Bash(git reset --hard*)",
  "Bash(git clean*)",
  "Bash(git checkout -- *)",
  "Bash(git push*)",
  "Bash(gh pr merge*)",
  "Bash(gh release*)",
];

const TICKET_IMPLEMENTER_INSTRUCTIONS = `You implement one GitHub ticket at a time: a bug fix or a small, self-contained feature.

Work in this order:
1. Read enough of the codebase to locate the code the ticket is about. Match the surrounding style, naming, and idiom.
2. Make the smallest change that satisfies the ticket. Do not refactor unrelated code, fix unrelated bugs, or expand scope. Flag anything out of scope in your final message instead of fixing it.
3. Write basic tests covering the behaviour the ticket describes: the reported failure for a bug, the happy path plus one edge case for a feature. Follow the repo's existing test framework and file layout rather than introducing a new one.
4. Run the repo's test command and iterate until the tests you added pass. If a pre-existing failure is unrelated to the ticket, report it rather than fixing it.

Do not commit, push, open pull requests, or otherwise change git state. Leave the work in the working tree for a human to review.

Finish with a short summary: what changed, which files, which tests were added, and anything you deliberately left alone.`;

function toSettingSources(scope: SettingsScope): SettingSource[] {
  switch (scope) {
    case "project":
      return ["project"];
    case "all":
      return ["user", "project", "local"];
    case "none":
    default:
      return [];
  }
}

export function buildAgentOptions(
  configuration: AgentRunConfiguration,
): Options {
  return {
    cwd: configuration.workingDirectory,
    // Keep the Claude Code system prompt (tool usage, code conventions) and
    // append the ticket-implementer behaviour on top of it.
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: TICKET_IMPLEMENTER_INSTRUCTIONS,
    },
    allowedTools: ALLOWED_TOOLS,
    disallowedTools: DESTRUCTIVE_COMMAND_DENY_RULES,
    // Edits are auto-approved so the run is headless; deny rules still apply.
    // Never bypassPermissions: allowedTools does not constrain that mode.
    permissionMode: "acceptEdits",
    // Explicit, so the agent does not inherit the target repo's hooks, skills,
    // and memory unless the caller asked for it with --settings.
    settingSources: toSettingSources(configuration.settingsScope),
    ...(configuration.model === undefined ? {} : { model: configuration.model }),
  };
}

export function buildAgentPrompt(ticket: GitHubTicket): string {
  return `Implement this ticket in the current working directory, then write basic tests for it.

${formatTicketForPrompt(ticket)}`;
}

export interface AgentRunSummary {
  subtype: string;
  isError: boolean;
  turnCount: number;
  finalMessage: string;
}

/**
 * Runs the agent to completion, streaming its reasoning and tool calls to
 * stdout as they arrive.
 */
export async function runTicketImplementationAgent(
  prompt: string,
  options: Options,
): Promise<AgentRunSummary> {
  let summary: AgentRunSummary = {
    subtype: "no_result",
    isError: true,
    turnCount: 0,
    finalMessage: "The agent stream ended without a result message.",
  };

  for await (const message of query({ prompt, options })) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if ("text" in block) {
          console.log(block.text);
        } else if ("name" in block) {
          console.log(`[tool] ${block.name}`);
        }
      }
    } else if (message.type === "result") {
      summary = {
        subtype: message.subtype,
        isError: message.is_error,
        turnCount: message.num_turns,
        finalMessage:
          message.subtype === "success" ? message.result : message.subtype,
      };
    }
  }

  return summary;
}
