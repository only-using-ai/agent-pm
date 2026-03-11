/* eslint-disable react-refresh/only-export-components -- exports AgentStreamProvider and useAgentStream */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getApiBase } from '@/lib/api'

export type StreamEvent =
  | 'stream_start'
  | 'stream_chunk'
  | 'stream_end'
  | 'stream_error'
  | 'work_item_updated'

export type WorkItemStatusUpdate = {
  work_item_id: string
  project_id: string
  status: string
}

export type AgentActionEntry = {
  text: string
}

interface AgentStreamContextValue {
  /** Agent IDs that are currently streaming */
  streamingAgentIds: Set<string>
  /** Work item IDs that currently have an agent actively working on them */
  activeWorkItemIds: Set<string>
  /** For each agent ID, the work item ID they are currently working on (from stream_start). */
  currentWorkItemIdByAgent: Record<string, string>
  /** Accumulated stream text per agent (latest run) */
  streamContent: Record<string, string>
  /** Accumulated model thinking/reasoning per agent (latest run) */
  streamThinking: Record<string, string>
  /** Last work item status update from agent tool call (for UI to sync column/status) */
  lastWorkItemStatusUpdate: WorkItemStatusUpdate | null
  /** Actions performed by each agent in the current run (e.g. status updates) */
  agentActions: Record<string, AgentActionEntry[]>
  /** Subscribe to stream for an agent (e.g. when viewing agent page). Call cleanup to disconnect. */
  subscribe: (agentId: string) => () => void
  /** Clear stream content for an agent */
  clearStream: (agentId: string) => void
}

const AgentStreamContext = createContext<AgentStreamContextValue | null>(null)

export function AgentStreamProvider({ children }: { children: ReactNode }) {
  const [streamingAgentIds, setStreamingAgentIds] = useState<Set<string>>(new Set())
  const [activeWorkItemIds, setActiveWorkItemIds] = useState<Set<string>>(new Set())
  const [currentWorkItemIdByAgent, setCurrentWorkItemIdByAgent] = useState<
    Record<string, string>
  >({})
  const [streamContent, setStreamContent] = useState<Record<string, string>>({})
  const [streamThinking, setStreamThinking] = useState<Record<string, string>>({})
  const [lastWorkItemStatusUpdate, setLastWorkItemStatusUpdate] =
    useState<WorkItemStatusUpdate | null>(null)
  const [agentActions, setAgentActions] = useState<Record<string, AgentActionEntry[]>>({})
  const MAX_ACTIONS_PER_AGENT = 20
  const streamStatusRef = useRef<EventSource | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const subscribedAgentIdRef = useRef<string | null>(null)
  const agentIdToWorkItemIdRef = useRef<Map<string, string>>(new Map())

  // Global stream status (start/end) so sidebar can show green indicator for any agent
  useEffect(() => {
    const es = new EventSource(`${getApiBase()}/api/agents/stream-status`)
    streamStatusRef.current = es
    es.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data) as {
          event: StreamEvent
          data: {
            agentId?: string
            work_item_id?: string
            project_id?: string
            status?: string
          }
        }
        const agentId = data?.agentId
        if (event === 'work_item_updated' && data?.work_item_id && data?.project_id && data?.status) {
          const status = data.status as string
          setLastWorkItemStatusUpdate({
            work_item_id: data.work_item_id,
            project_id: data.project_id,
            status,
          })
          if (agentId) {
            setAgentActions((prev) => {
              const list = [...(prev[agentId] ?? []), { text: `Status → ${status}` }]
              const trimmed = list.slice(-MAX_ACTIONS_PER_AGENT)
              return { ...prev, [agentId]: trimmed }
            })
          }
        } else if (agentId) {
          if (event === 'stream_start') {
            setStreamingAgentIds((prev) => new Set(prev).add(agentId))
            setAgentActions((prev) => ({ ...prev, [agentId]: [] }))
            const workItemId = data?.work_item_id
            if (typeof workItemId === 'string' && workItemId) {
              agentIdToWorkItemIdRef.current = new Map(agentIdToWorkItemIdRef.current).set(
                agentId,
                workItemId
              )
              setActiveWorkItemIds(new Set(agentIdToWorkItemIdRef.current.values()))
              setCurrentWorkItemIdByAgent((prev) => ({ ...prev, [agentId]: workItemId }))
            }
          } else if (event === 'stream_end' || event === 'stream_error') {
            setStreamingAgentIds((prev) => {
              const next = new Set(prev)
              next.delete(agentId)
              return next
            })
            const nextMap = new Map(agentIdToWorkItemIdRef.current)
            nextMap.delete(agentId)
            agentIdToWorkItemIdRef.current = nextMap
            setActiveWorkItemIds(new Set(nextMap.values()))
            setCurrentWorkItemIdByAgent((prev) => {
              const next = { ...prev }
              delete next[agentId]
              return next
            })
          }
        }
      } catch {
        // ignore
      }
    }
    return () => {
      es.close()
      streamStatusRef.current = null
    }
  }, [])

  const subscribe = useCallback((agentId: string) => {
    if (subscribedAgentIdRef.current === agentId) return () => {}
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      subscribedAgentIdRef.current = null
    }
    const url = `${getApiBase()}/api/agents/${agentId}/stream`
    const es = new EventSource(url)
    eventSourceRef.current = es
    subscribedAgentIdRef.current = agentId

    es.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data) as { event: StreamEvent; data: unknown }
        if (event === 'stream_start') {
          setStreamingAgentIds((prev) => new Set(prev).add(agentId))
          setStreamContent((prev) => ({ ...prev, [agentId]: '' }))
          setStreamThinking((prev) => ({ ...prev, [agentId]: '' }))
        } else if (event === 'stream_chunk' && data && typeof data === 'object' && 'chunk' in data) {
          const payload = data as { chunk: string; type?: string }
          const chunk = typeof payload.chunk === 'string' ? payload.chunk : ''
          const type = typeof payload.type === 'string' ? payload.type : 'content'
          // Thinking/reasoning tokens: accumulate for Reasoning component (streamed in real time)
          if (type === 'thinking') {
            setStreamThinking((prev) => ({
              ...prev,
              [agentId]: (prev[agentId] ?? '') + chunk,
            }))
          } else {
            setStreamContent((prev) => ({
              ...prev,
              [agentId]: (prev[agentId] ?? '') + chunk,
            }))
          }
        } else if (event === 'stream_end' || event === 'stream_error') {
          setStreamingAgentIds((prev) => {
            const next = new Set(prev)
            next.delete(agentId)
            return next
          })
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setStreamingAgentIds((prev) => {
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      subscribedAgentIdRef.current = null
    }
  }, [])

  const clearStream = useCallback((agentId: string) => {
    setStreamContent((prev) => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
    setStreamThinking((prev) => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
  }, [])

  const value: AgentStreamContextValue = {
    streamingAgentIds,
    activeWorkItemIds,
    currentWorkItemIdByAgent,
    streamContent,
    streamThinking,
    lastWorkItemStatusUpdate,
    agentActions,
    subscribe,
    clearStream,
  }

  return (
    <AgentStreamContext.Provider value={value}>
      {children}
    </AgentStreamContext.Provider>
  )
}

export function useAgentStream() {
  const ctx = useContext(AgentStreamContext)
  if (!ctx) throw new Error('useAgentStream must be used within AgentStreamProvider')
  return ctx
}
