import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkItemCreatedHandler } from '../work-item-created-handler.js'
import type { WorkItemCreatedPayload } from '../../hooks.js'
import type { AgentRow } from '../types.js'

// Mock deepagents so no real API is called
vi.mock('deepagents', () => ({
  createDeepAgent: vi.fn(() => ({
    stream: vi.fn().mockImplementation(async function* () {
      yield { content: 'Hello from agent.' }
    }),
    invoke: vi.fn(),
  })),
}))

describe('work-item-created-handler (LangChain)', () => {
  const mockPayload: WorkItemCreatedPayload = {
    id: 'wi-1',
    project_id: 'p-1',
    title: 'New task',
    description: null,
    assigned_to: 'agent-1',
    priority: 'Medium',
    depends_on: null,
    status: 'todo',
    require_approval: false,
    archived_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockAgent: AgentRow = {
    id: 'agent-1',
    name: 'Test Agent',
    team_id: 'team-1',
    instructions: 'Help the user.',
    ai_provider: 'ollama',
    model: 'llama3',
    created_at: new Date().toISOString(),
  }

  let mockGetPool: () => { query: ReturnType<typeof vi.fn> }
  let mockGetAgentById: ReturnType<typeof vi.fn>
  let mockGetProjectById: ReturnType<typeof vi.fn>
  let mockGetPromptByKey: ReturnType<typeof vi.fn>
  let mockGetContextContent: ReturnType<typeof vi.fn>
  let mockBuildContext: ReturnType<typeof vi.fn>
  let mockGetInitialMessages: ReturnType<typeof vi.fn>
  let mockUpdateWorkItem: ReturnType<typeof vi.fn>
  let mockAddWorkItemComment: ReturnType<typeof vi.fn>
  let mockListAgents: ReturnType<typeof vi.fn>
  let mockCreateWorkItem: ReturnType<typeof vi.fn>
  let mockEmitWorkItemCreated: ReturnType<typeof vi.fn>
  let mockBroadcaster: { broadcastToAgent: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockGetPool = vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }))
    mockGetAgentById = vi.fn().mockResolvedValue(mockAgent)
    mockGetProjectById = vi.fn().mockResolvedValue(null)
    mockGetPromptByKey = vi.fn().mockResolvedValue(null)
    mockGetContextContent = vi.fn().mockResolvedValue('')
    mockBuildContext = vi.fn().mockReturnValue({ userMessage: 'Do something', context: {}, variables: {} })
    mockGetInitialMessages = vi.fn().mockReturnValue([
      { role: 'system', content: '' },
      { role: 'user', content: '' },
    ])
    mockUpdateWorkItem = vi.fn().mockResolvedValue(null)
    mockAddWorkItemComment = vi.fn().mockResolvedValue(null)
    mockListAgents = vi.fn().mockResolvedValue([])
    mockCreateWorkItem = vi.fn().mockResolvedValue({ id: 'wi-new', project_id: 'p-1', title: 'New', assigned_to: null })
    mockEmitWorkItemCreated = vi.fn()
    mockBroadcaster = { broadcastToAgent: vi.fn() }
  })

  it('runs LangChain agent stream and broadcasts chunks', async () => {
    const { runAgentStream } = await import('../../agent/index.js')
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)

    expect(mockGetAgentById).toHaveBeenCalledWith(expect.anything(), 'agent-1')
    expect(mockGetProjectById).toHaveBeenCalledWith(expect.anything(), 'p-1')
    expect(mockGetPromptByKey).toHaveBeenCalledWith(expect.anything(), 'agent_system_prompt')
    expect(mockGetContextContent).toHaveBeenCalled()
    expect(mockBuildContext).toHaveBeenCalledWith(mockAgent, mockPayload, {
      template: null,
      areaContext: '',
      projectContext: '',
    })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_start', {
      work_item_id: 'wi-1',
      title: 'New task',
    })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_chunk', {
      chunk: 'Hello from agent.',
      type: 'content',
    })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_end', {})
  })

  it('broadcasts thinking chunks with type "thinking" so client can stream reasoning', async () => {
    const { createDeepAgent } = await import('deepagents')
    vi.mocked(createDeepAgent).mockReturnValueOnce({
      stream: vi.fn().mockImplementation(async function* () {
        yield { additional_kwargs: { thinking: 'Let me think...' } }
        yield { additional_kwargs: { thinking: ' step by step.' } }
        yield { content: 'Final answer.' }
      }),
      invoke: vi.fn(),
    } as unknown as ReturnType<typeof createDeepAgent>)
    const { runAgentStream } = await import('../../agent/index.js')
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)

    const streamChunkCalls = (mockBroadcaster.broadcastToAgent as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: [string, string, unknown]) => c[1] === 'stream_chunk'
    )
    const thinkingCalls = streamChunkCalls.filter((c: [string, string, { type?: string }]) => c[2]?.type === 'thinking')
    expect(thinkingCalls.length).toBeGreaterThanOrEqual(1)
    const thinkingChunks = thinkingCalls.map((c: [string, string, { chunk?: string }]) => c[2]?.chunk ?? '')
    expect(thinkingChunks.join('')).toContain('Let me think')
  })

  it('returns early when payload has no assigned_to', async () => {
    const { runAgentStream } = await import('../../agent/index.js')
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler({ ...mockPayload, assigned_to: null })
    expect(mockGetAgentById).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('returns early when agent not found', async () => {
    mockGetAgentById.mockResolvedValueOnce(null)
    const { runAgentStream } = await import('../../agent/index.js')
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBuildContext).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('returns early when require_approval is true (item goes to Inbox; agent starts on approve)', async () => {
    const { runAgentStream } = await import('../../agent/index.js')
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler({ ...mockPayload, require_approval: true })
    expect(mockGetAgentById).not.toHaveBeenCalled()
    expect(mockBuildContext).not.toHaveBeenCalled()
    expect(mockBroadcaster.broadcastToAgent).not.toHaveBeenCalled()
  })

  it('on stream error broadcasts stream_error and does not throw', async () => {
    const mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      throw new Error('Stream failed')
    })
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_error', {
      message: 'Stream failed',
    })
  })

  it('broadcasts tool_call chunks as content with "Tool: name" prefix', async () => {
    const mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      yield { type: 'tool_call', name: 'search', arguments: '{}', id: 'tc-1' }
      yield { type: 'content', text: 'Done.' }
    })
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_chunk', {
      chunk: 'Tool: search',
      type: 'content',
    })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_chunk', {
      chunk: 'Done.',
      type: 'content',
    })
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_end', {})
  })

  it('on stream error with non-Error value broadcasts String(value) as message', async () => {
    const mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      throw 'string error'
    })
    const mockLogError = vi.fn()
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
      logError: mockLogError,
    })
    await handler(mockPayload)
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith('agent-1', 'stream_error', {
      message: 'string error',
    })
  })

  it('uses custom log and logError when provided', async () => {
    const mockLog = vi.fn()
    const mockLogError = vi.fn()
    const mockRunAgentStream = vi.fn().mockImplementation(async function* () {
      yield { type: 'content', text: 'Hi' }
    })
    const handler = createWorkItemCreatedHandler({
      getPool: mockGetPool,
      getAgentById: mockGetAgentById,
      getProjectById: mockGetProjectById,
      getPromptByKey: mockGetPromptByKey,
      getContextContent: mockGetContextContent,
      buildContextForWorkItemCreated: mockBuildContext,
      getInitialMessages: mockGetInitialMessages,
      runAgentStream: mockRunAgentStream,
      updateWorkItem: mockUpdateWorkItem,
      addWorkItemComment: mockAddWorkItemComment,
      listAgents: mockListAgents,
      createWorkItem: mockCreateWorkItem,
      emitWorkItemCreated: mockEmitWorkItemCreated,
      broadcaster: mockBroadcaster,
      log: mockLog,
      logError: mockLogError,
    })
    await handler(mockPayload)
    expect(mockLog).toHaveBeenCalledWith('[agent Test Agent] ')
  })
})
