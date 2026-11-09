/**
 * test-utils/queryClient.tsx
 * A fresh TanStack Query client per render, as TanStack's testing guide
 * recommends, so no cache or in-flight request outlives its test.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createQueryClient } from '@/src/shared/lib/queryClient'

export function queryWrapper() {
  const client = createQueryClient()
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, wrapper: QueryWrapper }
}
