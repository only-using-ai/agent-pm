/* eslint-disable react-refresh/only-export-components -- exports McpProvider, useMcp, and McpTool type */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getApiBase } from '@/lib/api'

export interface McpTool {
  id: string
  name: string
  type: 'command' | 'url'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  description?: string
  created_at: string
}

interface McpContextValue {
  tools: McpTool[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  addTool: (tool: Omit<McpTool, 'id' | 'created_at'>) => Promise<McpTool>
  updateTool: (id: string, updates: Partial<Omit<McpTool, 'id' | 'created_at'>>) => Promise<void>
  removeTool: (id: string) => Promise<void>
}

const McpContext = createContext<McpContextValue | null>(null)

export function McpProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<McpTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${getApiBase()}/api/mcp`)
      if (!res.ok) throw new Error('Failed to load MCP tools')
      const data = await res.json()
      setTools(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load MCP tools')
      setTools([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const addTool = useCallback(async (tool: Omit<McpTool, 'id' | 'created_at'>): Promise<McpTool> => {
    const res = await fetch(`${getApiBase()}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tool.name,
        type: tool.type,
        command: tool.command ?? null,
        args: tool.args ?? [],
        url: tool.url ?? null,
        env: tool.env ?? {},
        description: tool.description ?? null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to add MCP tool')
    const created = data as McpTool
    setTools((prev) => [...prev, created])
    return created
  }, [])

  const updateTool = useCallback(async (id: string, updates: Partial<Omit<McpTool, 'id' | 'created_at'>>) => {
    const res = await fetch(`${getApiBase()}/api/mcp/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Failed to update MCP tool')
    }
    const updated = await res.json() as McpTool
    setTools((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }, [])

  const removeTool = useCallback(async (id: string) => {
    const res = await fetch(`${getApiBase()}/api/mcp/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Failed to remove MCP tool')
    }
    setTools((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo<McpContextValue>(
    () => ({ tools, loading, error, refetch, addTool, updateTool, removeTool }),
    [tools, loading, error, refetch, addTool, updateTool, removeTool]
  )

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>
}

export function useMcp() {
  const ctx = useContext(McpContext)
  if (!ctx) throw new Error('useMcp must be used within McpProvider')
  return ctx
}
