import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkItemAssignmentChangeHandler } from '../work-item-assignment-change-handler.js'
import type { AgentRow } from '../types.js'

describe('work-item-assignment-change-handler', () => {
  const mockPayload = {
    id: 'wi1',
    project_id: 'p1',
    title: 'Task',
    assigned_to: 'agent-1',
    description: null,
    priority: 'Medium',
    depends_on: null,
    status: 'todo',
    require_approval: false,
    archived_at: null,
    created_at: '',
    updated_at: '',
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

  let mockGetPool: () => { query: ReturnType<typeof vi.fn> }
  let mockGetAgentById: ReturnType<typeof vi.fn>
  let mockGetProjectById: ReturnType<typeof vi.fn>
  let mockGetPromptByKey: ReturnType<typeof vi.fn>
  let mockGetContextContent: ReturnType<typeof vi.fn>
  let mockBuildContext: ReturnType<typeof vi.fn>
  let mockGetInitialMessages: ReturnType<typeof vi.fn>
  let mockRunAgentStream: ReturnType<typeof vi.fn>
  let mockBroadcaster: { broadcastToAgent: ReturnType<typeof vi.fn> }
  const mockGetWorkItem = vi.fn().mockResolvedValue({ archived_at: null })
  const mockSetCurrentWorkItem = vi.fn()
  const mockClearCurrentWorkItem = vi.fn()

  beforeEach(() => {
    mockGetPool = vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }))
    mockGetAgentById = vi.fn().mockResolvedValue(mockAgent)
    mockGetProjectById = vi.fn().mockResolvedValue(null)
    mockGetPromptByKey = vi.fn().mockResolvedValue(null)
    mockGetContextContent = vi.fn().mockResolvedValue('')
    mockBuildContext = vi.fn().mockReturnValue({})
    mockGetInitialMessages = vi.fn().mockReturnValue([{ role: 'user', content: '' }])
    mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: 'Done.' }
    })
    mockBroadcaster = { broadcastToAgent: vi.fn() }
  })

  it('returns early when assigned_to is missing', async () => {
    const handler = createWorkItemAssignmentChangeHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemAssignmentChange: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      isCancelRequested: vi.fn().mockReturnValue(false),
      clearCancelRequested: vi.fn(),
      setCurrentWorkItem: mockSetCurrentWorkItem,
      clearCurrentWorkItem: mockClearCurrentWorkItem,
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      listAgents: vi.fn().mockResolvedValue([]),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler({ ...mockPayload, assigned_to: null })
    expect(mockGetAgentById).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('returns early when agent not found', async () => {
    mockGetAgentById.mockResolvedValue(null)
    const handler = createWorkItemAssignmentChangeHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemAssignmentChange: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      isCancelRequested: vi.fn().mockReturnValue(false),
      clearCancelRequested: vi.fn(),
      setCurrentWorkItem: mockSetCurrentWorkItem,
      clearCurrentWorkItem: mockClearCurrentWorkItem,
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      listAgents: vi.fn().mockResolvedValue([]),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBuildContext).not.toHaveBeenCalled()
  })

  it('runs stream and broadcasts stream_end', async () => {
    const handler = createWorkItemAssignmentChangeHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemAssignmentChange: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      isCancelRequested: vi.fn().mockReturnValue(false),
      clearCancelRequested: vi.fn(),
      setCurrentWorkItem: mockSetCurrentWorkItem,
      clearCurrentWorkItem: mockClearCurrentWorkItem,
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      listAgents: vi.fn().mockResolvedValue([]),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_start', expect.any(Object))
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_end', {})
  })
})
