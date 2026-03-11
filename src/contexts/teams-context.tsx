/* eslint-disable react-refresh/only-export-components -- exports TeamsProvider and useTeams */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getApiBase } from '@/lib/api'

export interface Team {
  id: string
  name: string
  created_at: string
}

interface TeamsContextValue {
  teams: Team[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTeam: (name: string) => Promise<Team>
}

const TeamsContext = createContext<TeamsContextValue | null>(null)

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${getApiBase()}/api/teams`)
      if (!res.ok) throw new Error('Failed to fetch teams')
      const data = await res.json()
      setTeams(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch teams')
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [])

  const createTeam = useCallback(
    async (name: string): Promise<Team> => {
      const res = await fetch(`${getApiBase()}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      await refetch()
      return data
    },
    [refetch]
  )

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <TeamsContext.Provider value={{ teams, loading, error, refetch, createTeam }}>
      {children}
    </TeamsContext.Provider>
  )
}

export function useTeams() {
  const ctx = useContext(TeamsContext)
  if (!ctx) throw new Error('useTeams must be used within TeamsProvider')
  return ctx
}
