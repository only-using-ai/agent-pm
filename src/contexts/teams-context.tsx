/* eslint-disable react-refresh/only-export-components -- exports TeamsProvider and useTeams */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useTeamsQuery, useCreateTeamMutation } from '@/hooks/queries'
import type { Team } from '@/lib/api'

interface TeamsContextValue {
  teams: Team[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTeam: (name: string) => Promise<Team>
}

const TeamsContext = createContext<TeamsContextValue | null>(null)

export type { Team }

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useTeamsQuery()
  const createTeamMutation = useCreateTeamMutation()
  const teams = useMemo(() => data ?? [], [data])
  const errorMessage = error instanceof Error ? error.message : null

  const value = useMemo<TeamsContextValue>(
    () => ({
      teams,
      loading: isLoading,
      error: errorMessage,
      refetch: async () => {
        await refetch()
      },
      createTeam: async (name: string) => {
        const team = await createTeamMutation.mutateAsync(name)
        return team
      },
    }),
    [teams, isLoading, errorMessage, refetch, createTeamMutation]
  )

  return (
    <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>
  )
}

export function useTeams() {
  const ctx = useContext(TeamsContext)
  if (!ctx) throw new Error('useTeams must be used within TeamsProvider')
  return ctx
}
