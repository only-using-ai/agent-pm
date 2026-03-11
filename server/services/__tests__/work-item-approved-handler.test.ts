import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkItemApprovedHandler } from '../work-item-approved-handler.js'
import type { AgentRow } from '../types.js'

describe('work-item-approved-handler', () => {
  const mockPayload = {
    agent_id: 'agent-1',
    project_id: 'p1',
    work_item_id: 'wi1',
    body: 'Approved',
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
    assigned_to: 'agent-1',
    priority: 'Medium',
    depends_on: null,
    status: 'todo',
    require_approval: false,
    archived_at: null,
    created_at: '',
    updated_at: '',
  }

  let mockGetPool: () => { query: ReturnType<typeof vi.fn> }
  let mockGetAgentById: ReturnType<typeof vi.fn>
  let mockGetWorkItem: ReturnType<typeof vi.fn>
  let mockBuildContext: ReturnType<typeof vi.fn>
  let mockGetInitialMessages: ReturnType<typeof vi.fn>
  let mockRunAgentStream: ReturnType<typeof vi.fn>
  let mockBroadcaster: { broadcastToAgent: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockGetPool = vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }))
    mockGetAgentById = vi.fn().mockResolvedValue(mockAgent)
    mockGetWorkItem = vi.fn().mockResolvedValue(mockWorkItem)
    mockBuildContext = vi.fn().mockReturnValue({})
    mockGetInitialMessages = vi.fn().mockReturnValue([{ role: 'user', content: '' }])
    mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: 'Done.' }
    })
    mockBroadcaster = { broadcastToAgent: vi.fn() }
  })

  it('returns early when agent_id is missing', async () => {
    const handler = createWorkItemApprovedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      buildContextForWorkItemApproved: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      listAgents: vi.fn().mockResolvedValue([]),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler({ ...mockPayload, agent_id: '' })
    expect(mockGetAgentById).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('returns early when agent or work item not found', async () => {
    mockGetAgentById.mockResolvedValue(null)
    const handler = createWorkItemApprovedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      buildContextForWorkItemApproved: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
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

  it('runs stream and broadcasts chunks then stream_end', async () => {
    const handler = createWorkItemApprovedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      buildContextForWorkItemApproved: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      listAgents: vi.fn().mockResolvedValue([]),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_start', expect.any(Object))
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_chunk', { chunk: 'Done.', type: 'content' })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_end', {})
  })

  it('on stream error broadcasts stream_error', async () => {
    // eslint-disable-next-line require-yield
    mockRunAgentStream.mockImplementation(async function* () {
      throw new Error('Stream failed')
    })
    const handler = createWorkItemApprovedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getWorkItem: mockGetWorkItem,
      buildContextForWorkItemApproved: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: vi.fn().mockResolvedValue(null),
      addWorkItemComment: vi.fn().mockResolvedValue(null),
      listAgents: vi.fn().mockResolvedValue([]),
      createWorkItem: vi.fn().mockResolvedValue({}),
      emitWorkItemCreated: vi.fn(),
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_error', { message: 'Stream failed' })
  })
})
