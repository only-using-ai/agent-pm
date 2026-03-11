import { QueryClient } from '@tanstack/react-query'

const defaultStaleTime = 30 * 1000 // 30 seconds
const defaultGcTime = 5 * 60 * 1000 // 5 minutes (formerly cacheTime)

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: defaultStaleTime,
        gcTime: defaultGcTime,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export const queryClient = createQueryClient()
