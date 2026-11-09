import { QueryClient } from '@tanstack/react-query'

/**
 * Requests report their own failures; the user chooses when to retry.
 * AppProviders creates one client for the app; tests create one per test.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}
