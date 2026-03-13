/* eslint-disable react-refresh/only-export-components -- exports ProjectsProvider and useProjects */
import { createContext, useContext, useMemo } from 'react'
import { useProjectsQuery, useCompletedProjectsQuery } from '@/hooks/queries'
import type { Project } from '@/lib/api'

type ProjectsContextValue = {
  projects: Project[]
  completedProjects: Project[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error, refetch } = useProjectsQuery()
  const { data: completedData } = useCompletedProjectsQuery()
  const projects = useMemo(() => data ?? [], [data])
  const completedProjects = useMemo(() => completedData ?? [], [completedData])
  const errorMessage = error instanceof Error ? error.message : null

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      completedProjects,
      loading: isLoading,
      error: errorMessage,
      refetch: async () => {
        await refetch()
      },
    }),
    [projects, completedProjects, isLoading, errorMessage, refetch]
  )

  return (
    <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
  )
}

export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
