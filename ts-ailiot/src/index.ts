import {
  CLI_USAGE,
  isCliArgumentError,
  parseCliArguments,
  type AgentRunConfiguration,
} from './cli.js'
import {
  buildAgentOptions,
  buildAgentPrompt,
  runTicketImplementationAgent,
} from './agent.js'
import { fetchGitHubTicket } from './ticket.js'

async function main(): Promise<number> {
  let configuration: AgentRunConfiguration | undefined
  try {
    configuration = parseCliArguments(process.argv.slice(2))
  } catch (error) {
    if (isCliArgumentError(error)) {
      console.error(`${(error as Error).message}\n\n${CLI_USAGE}`)
      return 2
    }
    throw error
  }

  if (configuration === undefined) {
    console.log(CLI_USAGE)
    return 0
  }

  if (!configuration.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is not set. The Agent SDK reads it from the process ' +
        'environment and does not load .env files. See .env.example.',
    )
    return 2
  }

  const ticket = await fetchGitHubTicket(
    configuration.issueNumber,
    configuration.workingDirectory,
    configuration.repository,
  )
  const prompt = buildAgentPrompt(ticket)
  const options = buildAgentOptions(configuration)

  if (configuration.dryRun) {
    console.log('--- prompt ---')
    console.log(prompt)
    console.log('\n--- options ---')
    console.log(JSON.stringify(options, null, 2))
    return 0
  }

  console.log(
    `Implementing #${ticket.number} in ${configuration.workingDirectory}\n`,
  )
  const summary = await runTicketImplementationAgent(prompt, options)
  console.log(`\n--- ${summary.subtype} after ${summary.turnCount} turns ---`)
  console.log(summary.finalMessage)
  return summary.isError ? 1 : 0
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
