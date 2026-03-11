/* eslint-disable react-refresh/only-export-components -- exports AgentsProvider, useAgents, and Agent type */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getApiBase } from '@/lib/api'

export interface Agent {
  id: string
  name: string
  team_id: string
  instructions: string | null
  ai_provider: string | null
  model: string | null
  created_at: string
}

interface AgentsContextValue {
  agents: Agent[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const AgentsContext = createContext<AgentsContextValue | null>(null)

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${getApiBase()}/api/agents`)
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data = await res.json()
      setAgents(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch agents')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <AgentsContext.Provider value={{ agents, loading, error, refetch }}>
      {children}
    </AgentsContext.Provider>
  )
}

export function useAgents() {
  const ctx = useContext(AgentsContext)
  if (!ctx) throw new Error('useAgents must be used within AgentsProvider')
  return ctx
}
