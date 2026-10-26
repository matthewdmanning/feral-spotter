import type { EmailListConfig, EmailListProvider } from './EmailListProvider'
import { createEmailOctopusProvider } from './emailOctopus'

const PROVIDERS: Record<
  string,
  (config: EmailListConfig) => EmailListProvider
> = {
  emailoctopus: createEmailOctopusProvider,
}

export const DEFAULT_EMAIL_PROVIDER = 'emailoctopus'

export function createEmailListProvider(
  name: string,
  config: EmailListConfig,
): EmailListProvider {
  const create = PROVIDERS[name]
  if (!create) throw new Error(`Unknown email provider: ${name}`)
  return create(config)
}
