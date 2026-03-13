import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkItemCommentedHandler } from '../work-item-commented-handler.js'
import type { AgentRow } from '../types.js'

describe('work-item-commented-handler', () => {
  const mockPayload = {
    project_id: 'p1',
    work_item_id: 'wi1',
    mentioned_agent_ids: ['agent-1'],
  }

  const mockAgent: AgentRow = {
    id: 'agent-1',
    name: 'Test Agent',
    team_id: 't1',
    instructions: null,
    ai_provider: 'ollama',
    model: null,
    created_at: '',
    archived_at: null,
  }

  const mockWorkItem = {
    id: 'wi1',
    project_id: 'p1',
    title: 'Task',
    description: null,
    priority: 'Medium',
    status: 'todo',
    comments: [
      { author_type: 'user', author_id: null, body: 'Hello', created_at: '2025-01-01' },
    ],
  }

  let mockGetPool: () => { query: ReturnType<typeof vi.fn> }
  let mockGetAgentById: ReturnType<typeof vi.fn>
  let mockGetWorkItem: ReturnType<typeof vi.fn>
  let mockListAgents: ReturnType<typeof vi.fn>
  let mockGetProjectById: ReturnType<typeof vi.fn>
  let mockGetPromptByKey: ReturnType<typeof vi.fn>
  let mockGetContextContent: ReturnType<typeof vi.fn>
  let mockBuildContext: ReturnType<typeof vi.fn>
  let mockGetInitialMessages: ReturnType<typeof vi.fn>
  let mockRunAgentStream: ReturnType<typeof vi.fn>
  let mockBroadcaster: { broadcastToAgent: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockGetPool = vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }))
    mockGetAgentById = vi.fn().mockResolvedValue(mockAgent)
    mockGetWorkItem = vi.fn().mockResolvedValue(mockWorkItem)
    mockListAgents = vi.fn().mockResolvedValue([{ id: 'agent-1', name: 'Test Agent', team_id: 't1', instructions: null }])
    mockGetProjectById = vi.fn().mockResolvedValue(null)
    mockGetPromptByKey = vi.fn().mockResolvedValue(null)
    mockGetContextContent = vi.fn().mockResolvedValue('')
    mockBuildContext = vi.fn().mockReturnValue({})
    mockGetInitialMessages = vi.fn().mockReturnValue([{ role: 'user', content: '' }])
    mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: 'Replied.' }
    })
    mockBroadcaster = { broadcastToAgent: vi.fn() }
  })

  it('returns early when work item not found', async () => {
    mockGetWorkItem.mockResolvedValue(null)
    const handler = createWorkItemCommentedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getWorkItem: mockGetWorkItem,
      listAgents: mockListAgents,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCommented: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      isCancelRequested: vi.fn().mockReturnValue(false),
      clearCancelRequested: vi.fn(),
      setCurrentWorkItem: vi.fn(),
      clearCurrentWorkItem: vi.fn(),
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockGetAgentById).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('skips mentioned agent that is not found', async () => {
    mockGetAgentById.mockResolvedValue(null)
    const handler = createWorkItemCommentedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getWorkItem: mockGetWorkItem,
      listAgents: mockListAgents,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCommented: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      isCancelRequested: vi.fn().mockReturnValue(false),
      clearCancelRequested: vi.fn(),
      setCurrentWorkItem: vi.fn(),
      clearCurrentWorkItem: vi.fn(),
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBuildContext).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('runs stream for each mentioned agent and broadcasts stream_end', async () => {
    const handler = createWorkItemCommentedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getWorkItem: mockGetWorkItem,
      listAgents: mockListAgents,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCommented: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      isCancelRequested: vi.fn().mockReturnValue(false),
      clearCancelRequested: vi.fn(),
      setCurrentWorkItem: vi.fn(),
      clearCurrentWorkItem: vi.fn(),
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_start', expect.any(Object))
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_chunk', { chunk: 'Replied.', type: 'content' })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_end', {})
  })
})
