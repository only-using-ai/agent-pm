/* eslint-disable react-refresh/only-export-components -- exports AgentsProvider, useAgents, and Agent type */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAgentsQuery } from '@/hooks/queries'
import type { Agent } from '@/lib/api'

interface AgentsContextValue {
  agents: Agent[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const AgentsContext = createContext<AgentsContextValue | null>(null)

export type { Agent }

export function AgentsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useAgentsQuery()
  const agents = useMemo(() => data ?? [], [data])
  const errorMessage = error instanceof Error ? error.message : null

  const value = useMemo<AgentsContextValue>(
    () => ({
      agents,
      loading: isLoading,
      error: errorMessage,
      refetch: async () => {
        await refetch()
      },
    }),
    [agents, isLoading, errorMessage, refetch]
  )

  return (
    <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
  )
}

export function useAgents() {
  const ctx = useContext(AgentsContext)
  if (!ctx) throw new Error('useAgents must be used within AgentsProvider')
  return ctx
}
