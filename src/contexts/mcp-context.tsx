/* eslint-disable react-refresh/only-export-components -- exports McpProvider, useMcp, and McpTool type */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  useMcpToolsQuery,
  useCreateMcpToolMutation,
  useUpdateMcpToolMutation,
  useDeleteMcpToolMutation,
} from '@/hooks/queries'
import type { McpTool } from '@/lib/api'

interface McpContextValue {
  tools: McpTool[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  addTool: (tool: Omit<McpTool, 'id' | 'created_at'>) => Promise<McpTool>
  updateTool: (
    id: string,
    updates: Partial<Omit<McpTool, 'id' | 'created_at'>>
  ) => Promise<void>
  removeTool: (id: string) => Promise<void>
}

const McpContext = createContext<McpContextValue | null>(null)

export type { McpTool }

export function McpProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useMcpToolsQuery()
  const createMutation = useCreateMcpToolMutation()
  const updateMutation = useUpdateMcpToolMutation()
  const deleteMutation = useDeleteMcpToolMutation()
  const tools = useMemo(() => data ?? [], [data])
  const errorMessage = error instanceof Error ? error.message : null

  const value = useMemo<McpContextValue>(
    () => ({
      tools,
      loading: isLoading,
      error: errorMessage,
      refetch: async () => {
        await refetch()
      },
      addTool: async (tool: Omit<McpTool, 'id' | 'created_at'>) => {
        return createMutation.mutateAsync({
          name: tool.name,
          type: tool.type,
          command: tool.command ?? null,
          args: tool.args ?? undefined,
          url: tool.url ?? null,
          env: tool.env ?? undefined,
          description: tool.description ?? null,
        })
      },
      updateTool: async (
        id: string,
        updates: Partial<Omit<McpTool, 'id' | 'created_at'>>
      ) => {
        await updateMutation.mutateAsync({ id, body: updates })
      },
      removeTool: async (id: string) => {
        await deleteMutation.mutateAsync(id)
      },
    }),
    [
      tools,
      isLoading,
      errorMessage,
      refetch,
      createMutation,
      updateMutation,
      deleteMutation,
    ]
  )

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>
}

export function useMcp() {
  const ctx = useContext(McpContext)
  if (!ctx) throw new Error('useMcp must be used within McpProvider')
  return ctx
}
