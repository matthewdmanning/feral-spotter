import { QueryClient } from '@tanstack/react-query'

/** Requests report their own failures; the user chooses when to retry. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
