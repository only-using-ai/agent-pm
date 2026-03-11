/**
 * Cursor CLI runner: runs the Cursor Agent via the local CLI instead of the API.
 * Spawns `cursor agent -p --output-format stream-json --stream-partial-output --model <id> ...`
 * and parses NDJSON to stream content, thinking (when present), and tool_call chunks.
 *
 * Docs: https://cursor.com/docs/cli/headless
 *       https://cursor.com/docs/cli/reference/output-format
 *
 * Thinking/reasoning: Cursor docs state that "thinking events are suppressed in print mode
 * and will not appear in any output format". We still parse and stream any content blocks with
 * type "thinking" or "reasoning" so that if Cursor adds support later, the client will
 * receive thinking chunks without code changes.
 */

import { spawn } from 'node:child_process'
import type { StreamChunk, ChatMessage } from './types.js'
import type { WorkItemToolContext } from './langchain-tools.js'
import { getCursorCliPath, getCursorDefaultModel } from '../config.js'

const AGENT_ACTION_REGEX = /^__AGENT_ACTION__\s+(\w+)\s+(.+)$/
const WORK_ITEM_STATUS_VALUES = ['todo', 'in_progress', 'completed', 'blocked', 'canceled'] as const

export type CursorCLIRunOptions = {
  model?: string | null
  /** Workspace directory (--workspace). */
  workspace?: string
  /** Extra env (e.g. CURSOR_API_KEY). */
  env?: NodeJS.ProcessEnv
  /**
   * When set, assistant content is scanned for __AGENT_ACTION__ lines.
   * Matching lines are executed as update_work_item_status / add_work_item_comment
   * and replaced with a short confirmation in the stream.
   */
  toolContext?: WorkItemToolContext
}

/**
 * Build a single prompt from chat messages for the CLI (which accepts one initial prompt).
 * System + user are combined; assistant/tool turns are summarized or omitted for simplicity.
 */
export function messagesToSinglePrompt(messages: ChatMessage[]): string {
  const parts: string[] = []
  for (const m of messages) {
    switch (m.role) {
      case 'system':
        parts.push(`[System]\n${m.content}`)
        break
      case 'user':
        parts.push(`[User]\n${m.content}`)
        break
      case 'assistant':
        if (m.content) parts.push(`[Assistant]\n${m.content}`)
        if (m.tool_calls?.length) {
          parts.push(
            `[Tool calls: ${m.tool_calls.map((tc) => tc.name).join(', ')}]`
          )
        }
        break
      case 'tool':
        parts.push(`[Tool result for ${m.tool_call_id ?? '?'}]\n${m.content}`)
        break
      default:
        parts.push(m.content)
    }
  }
  return parts.join('\n\n')
}

/**
 * Unique key for an executed action so we only run it once per stream run.
 * Cursor CLI with --stream-partial-output can send the same assistant content
 * in multiple events, causing duplicate status updates and comments otherwise.
 */
function actionKey(toolName: string, args: Record<string, unknown>): string | null {
  if (toolName === 'update_work_item_status') {
    const status = typeof args?.status === 'string' ? args.status.trim() : ''
    return status ? `update_work_item_status:${status}` : null
  }
  if (toolName === 'add_work_item_comment') {
    const body = typeof args?.body === 'string' ? args.body.trim() : ''
    return body ? `add_work_item_comment:${body}` : null
  }
  if (toolName === 'list_available_agents') {
    return 'list_available_agents:1'
  }
  if (toolName === 'create_work_item_and_assign') {
    const title = typeof args?.title === 'string' ? args.title.trim() : ''
    return title ? `create_work_item_and_assign:${title}` : null
  }
  if (toolName === 'request_for_approval') {
    const workItemId = typeof args?.work_item_id === 'string' ? args.work_item_id.trim() : ''
    const text = typeof args?.text === 'string' ? args.text.trim() : ''
    return workItemId && text ? `request_for_approval:${workItemId}:${text.slice(0, 50)}` : null
  }
  if (toolName === 'link_asset_to_work_item') {
    const assetId = typeof args?.asset_id === 'string' ? args.asset_id.trim() : ''
    return assetId ? `link_asset_to_work_item:${assetId}` : null
  }
  if (toolName === 'create_asset_and_link_to_work_item') {
    const name = typeof args?.name === 'string' ? args.name.trim() : ''
    return name ? `create_asset_and_link_to_work_item:${name}` : null
  }
  return null
}

/**
 * Process assistant text: when toolContext is set, look for lines
 * __AGENT_ACTION__ <tool> <json>. Execute at most once per (tool, args); yield confirmation.
 */
async function* processContentWithActions(
  text: string,
  toolContext: WorkItemToolContext,
  contentBuffer: { current: string },
  executedActionKeys: Set<string>
): AsyncGenerator<StreamChunk, void, unknown> {
  contentBuffer.current += text
  const lines = contentBuffer.current.split(/\r?\n/)
  contentBuffer.current = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(AGENT_ACTION_REGEX)
    if (match) {
      const [, toolName, argsStr] = match
      let parsed: unknown
      try {
        parsed = JSON.parse(argsStr.trim())
      } catch {
        yield { type: 'content', text: trimmed + '\n' }
        continue
      }
      const args = parsed as Record<string, unknown>
      const key = actionKey(toolName, args)
      const alreadyExecuted = key !== null && executedActionKeys.has(key)
      if (key !== null) executedActionKeys.add(key)

      try {
        if (toolName === 'update_work_item_status') {
          const status = typeof args?.status === 'string' ? args.status.trim() : ''
          if (status && (WORK_ITEM_STATUS_VALUES as readonly string[]).includes(status)) {
            if (!alreadyExecuted) {
              await toolContext.updateWorkItem(
                toolContext.pool,
                toolContext.projectId,
                toolContext.workItemId,
                { status }
              )
              toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'work_item_updated', {
                work_item_id: toolContext.workItemId,
                project_id: toolContext.projectId,
                status,
              })
            }
            yield { type: 'content', text: `[Status updated to ${status}.]\n` }
          }
        } else if (toolName === 'add_work_item_comment') {
          const body = typeof args?.body === 'string' ? args.body.trim() : ''
          if (body) {
            if (!alreadyExecuted) {
              await toolContext.addWorkItemComment(
                toolContext.pool,
                toolContext.projectId,
                toolContext.workItemId,
                body,
                { author_type: 'agent', author_id: toolContext.agentId }
              )
              toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'stream_chunk', {
                chunk: 'Comment added successfully.',
                type: 'content',
              })
            }
            yield { type: 'content', text: '[Comment added.]\n' }
          }
        } else if (toolName === 'list_available_agents') {
          if (!alreadyExecuted) {
            const agents = await toolContext.listAgents(toolContext.pool)
            const lines = agents.map((a) => `- ${a.name} (id: \`${a.id}\`)`)
            const msg = `[Available agents:\n${lines.join('\n')}]\n`
            yield { type: 'content', text: msg }
          } else {
            yield { type: 'content', text: '[Available agents: already listed.]\n' }
          }
        } else if (toolName === 'create_work_item_and_assign') {
          const title = typeof args?.title === 'string' ? args.title.trim() : ''
          if (!title) {
            yield { type: 'content', text: '[create_work_item_and_assign: title is required.]\n' }
          } else {
            let assigneeId = typeof args?.assigned_to_agent_id === 'string' ? args.assigned_to_agent_id.trim() : ''
            if (assigneeId === 'self' || assigneeId === '') assigneeId = toolContext.agentId
            const priority =
              typeof args?.priority === 'string' && ['Low', 'Medium', 'High', 'Critical'].includes(args.priority)
                ? args.priority
                : 'Medium'
            const description =
              typeof args?.description === 'string' ? args.description.trim() || null : null
            const dependsOn =
              typeof args?.depends_on === 'string' ? args.depends_on.trim() || null : null
            if (!alreadyExecuted) {
              const row = await toolContext.createWorkItem(toolContext.pool, toolContext.projectId, {
                title,
                description,
                assigned_to: assigneeId,
                priority,
                depends_on: dependsOn,
                status: 'todo',
              })
              if (toolContext.emitWorkItemCreated && row) {
                toolContext.emitWorkItemCreated(row)
              }
              toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'stream_chunk', {
                chunk: `Created work item "${row.title}" (id: ${row.id}) and assigned to agent.`,
                type: 'content',
              })
              yield { type: 'content', text: `[Created work item "${row.title}" and assigned.]\n` }
            } else {
              yield { type: 'content', text: `[Work item "${title}" already created.]\n` }
            }
          }
        } else if (toolName === 'request_for_approval') {
          const text = typeof args?.text === 'string' ? args.text.trim() : ''
          const workItemId = typeof args?.work_item_id === 'string' ? args.work_item_id.trim() : ''
          const agentName = typeof args?.agent_name === 'string' ? args.agent_name.trim() : ''
          if (!text || !workItemId) {
            yield { type: 'content', text: '[request_for_approval: text and work_item_id are required.]\n' }
          } else if (toolContext.createApprovalRequest && !alreadyExecuted) {
            const row = await toolContext.createApprovalRequest(toolContext.pool, {
              work_item_id: workItemId,
              project_id: toolContext.workItemId === workItemId ? toolContext.projectId : undefined,
              agent_id: toolContext.agentId,
              agent_name: agentName || 'Agent',
              body: text,
            })
            toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'stream_chunk', {
              chunk: 'Approval request sent to inbox.',
              type: 'content',
            })
            yield { type: 'content', text: `[Approval request created and added to Inbox (id: ${row.id}).]\n` }
          } else if (alreadyExecuted) {
            yield { type: 'content', text: '[Approval request already sent.]\n' }
          } else {
            yield { type: 'content', text: '[request_for_approval not available in this context.]\n' }
          }
        } else if (toolName === 'request_info') {
          const message = typeof args?.message === 'string' ? args.message.trim() : ''
          const workItemId = typeof args?.work_item_id === 'string' ? args.work_item_id.trim() : ''
          const agentName = typeof args?.agent_name === 'string' ? args.agent_name.trim() : ''
          if (!message || !workItemId) {
            yield { type: 'content', text: '[request_info: message and work_item_id are required.]\n' }
          } else if (toolContext.createInfoRequest && !alreadyExecuted) {
            const row = await toolContext.createInfoRequest(toolContext.pool, {
              work_item_id: workItemId,
              project_id: toolContext.workItemId === workItemId ? toolContext.projectId : undefined,
              agent_id: toolContext.agentId,
              agent_name: agentName || 'Agent',
              body: message,
            })
            toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'stream_chunk', {
              chunk: 'Info request sent to inbox.',
              type: 'content',
            })
            yield { type: 'content', text: `[Info request created and added to Inbox (id: ${row.id}).]\n` }
          } else if (alreadyExecuted) {
            yield { type: 'content', text: '[Info request already sent.]\n' }
          } else {
            yield { type: 'content', text: '[request_info not available in this context.]\n' }
          }
        } else if (toolName === 'link_asset_to_work_item') {
          const assetId = typeof args?.asset_id === 'string' ? args.asset_id.trim() : ''
          if (!assetId) {
            yield { type: 'content', text: '[link_asset_to_work_item: asset_id is required.]\n' }
          } else if (toolContext.linkAssetToWorkItem && !alreadyExecuted) {
            const { linked } = await toolContext.linkAssetToWorkItem(
              toolContext.pool,
              toolContext.projectId,
              toolContext.workItemId,
              assetId
            )
            toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'stream_chunk', {
              chunk: linked ? 'Asset linked to work item.' : 'Asset was already linked.',
              type: 'content',
            })
            yield { type: 'content', text: linked ? '[Asset linked to work item.]\n' : '[Asset was already linked.]\n' }
          } else if (alreadyExecuted) {
            yield { type: 'content', text: '[Asset link already applied.]\n' }
          } else {
            yield { type: 'content', text: '[link_asset_to_work_item not available in this context.]\n' }
          }
        } else if (toolName === 'create_asset_and_link_to_work_item') {
          const name = typeof args?.name === 'string' ? args.name.trim() : ''
          if (!name) {
            yield { type: 'content', text: '[create_asset_and_link_to_work_item: name is required.]\n' }
          } else if (toolContext.createAsset && !alreadyExecuted) {
            const type = args?.type === 'file' || args?.type === 'link' || args?.type === 'folder' ? args.type : 'file'
            const row = await toolContext.createAsset(toolContext.pool, toolContext.projectId, {
              name,
              type,
              path: typeof args?.path === 'string' ? args.path.trim() || null : null,
              url: typeof args?.url === 'string' ? args.url.trim() || null : null,
              work_item_ids: [toolContext.workItemId],
            })
            toolContext.broadcaster.broadcastToAgent(toolContext.agentId, 'stream_chunk', {
              chunk: `Asset "${row.name}" created and linked to work item (id: ${row.id}).`,
              type: 'content',
            })
            yield { type: 'content', text: `[Asset "${row.name}" created and linked (id: ${row.id}).]\n` }
          } else if (alreadyExecuted) {
            yield { type: 'content', text: '[Asset already created and linked.]\n' }
          } else {
            yield { type: 'content', text: '[create_asset_and_link_to_work_item not available in this context.]\n' }
          }
        } else {
          yield { type: 'content', text: trimmed + '\n' }
        }
      } catch (e) {
        if (key !== null) executedActionKeys.delete(key)
        console.error(`[cursor-cli __AGENT_ACTION__ ${toolName}]`, e)
        yield { type: 'content', text: `[Action ${toolName} failed.]\n` }
      }
    } else {
      yield { type: 'content', text: line + '\n' }
    }
  }
}

/** Extract tool name and args from a stream-json tool_call event. */
function parseToolCallEvent(event: Record<string, unknown>): { id: string; name: string; args: string } | null {
  const _subtype = event.subtype as string
  const callId = (event.call_id as string) ?? ''
  const toolCall = event.tool_call as Record<string, unknown> | undefined
  if (!toolCall) return null

  // readToolCall / writeToolCall
  if (typeof toolCall.readToolCall === 'object' && toolCall.readToolCall !== null) {
    const r = toolCall.readToolCall as { args?: { path?: string } }
    const args = r.args ? JSON.stringify(r.args) : '{}'
    return { id: callId, name: 'read_file', args }
  }
  if (typeof toolCall.writeToolCall === 'object' && toolCall.writeToolCall !== null) {
    const w = toolCall.writeToolCall as { args?: Record<string, unknown> }
    const args = w.args ? JSON.stringify(w.args) : '{}'
    return { id: callId, name: 'write_file', args }
  }

  // Generic function (name + arguments string)
  const fn = toolCall.function as { name?: string; arguments?: string } | undefined
  if (fn?.name) {
    return {
      id: callId,
      name: fn.name,
      args: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
    }
  }
  return null
}

/**
 * Run Cursor Agent via CLI and stream NDJSON events as StreamChunk.
 * Uses --output-format stream-json and --stream-partial-output for real-time content deltas.
 * Parses and yields thinking chunks when present; per Cursor docs they are currently
 * suppressed in print mode, so none may appear until/unless Cursor adds support.
 */
export async function* runCursorCLIStream(
  messages: ChatMessage[],
  options?: CursorCLIRunOptions
): AsyncIterable<StreamChunk> {
  const prompt = messagesToSinglePrompt(messages)
  const model = (options?.model?.trim() || getCursorDefaultModel()).trim()
  const workspace = options?.workspace
  const env = { ...process.env, ...options?.env }

  const args = [
    'agent',
    '-p',
    '--output-format',
    'stream-json',
    '--stream-partial-output',
    '--force',
    '--trust',
    '--model',
    model,
  ]
  if (workspace) {
    args.push('--workspace', workspace)
  }
  args.push(prompt)

  const spawnOpts: { env: NodeJS.ProcessEnv; stdio: ('ignore' | 'pipe')[]; shell?: boolean; cwd?: string } = {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  }
  if (workspace) {
    spawnOpts.cwd = workspace
  }
  const proc = spawn(getCursorCliPath(), args, spawnOpts)

  let buffer = ''
  const stdout = proc.stdout
  const stderr = proc.stderr
  if (!stdout || !stderr) {
    throw new Error('Cursor CLI spawn failed: no stdout/stderr')
  }

  stderr.on('data', (chunk: Buffer) => {
    // Log CLI stderr (e.g. progress) but don't emit as chunks
    process.stderr.write(chunk)
  })

  const contentBuffer = { current: '' }
  const toolCtx = options?.toolContext
  const executedActionKeys = new Set<string>()

  const stream = (async function* (): AsyncIterable<StreamChunk> {
    for await (const chunk of stdout) {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const event = JSON.parse(trimmed) as Record<string, unknown>
          const type = event.type as string
          if (type === 'assistant') {
            const msg = event.message as {
              content?: Array<{
                type?: string
                text?: string
                reasoning?: string
                thinking?: string
              }>
            } | undefined
            const content = msg?.content
            if (Array.isArray(content)) {
              for (const block of content) {
                if (!block || !block.type) continue
                // Thinking/reasoning: stream so client can show reasoning (if CLI ever sends these in print mode)
                const isReasoningBlock = block.type === 'reasoning' || block.type === 'thinking'
                if (isReasoningBlock) {
                  const thinkingText =
                    typeof block.reasoning === 'string'
                      ? block.reasoning
                      : typeof block.thinking === 'string'
                        ? block.thinking
                        : typeof block.text === 'string'
                          ? block.text
                          : ''
                  if (thinkingText) yield { type: 'thinking', text: thinkingText }
                  continue
                }
                if (block.type === 'text' && typeof block.text === 'string' && block.text) {
                  if (toolCtx) {
                    for await (const c of processContentWithActions(
                      block.text,
                      toolCtx,
                      contentBuffer,
                      executedActionKeys
                    )) {
                      yield c
                    }
                  } else {
                    yield { type: 'content', text: block.text }
                  }
                }
              }
            }
          }
          if (type === 'tool_call') {
            const parsed = parseToolCallEvent(event)
            if (parsed) {
              yield {
                type: 'tool_call',
                id: parsed.id,
                name: parsed.name,
                arguments: parsed.args,
              }
            }
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
    // Flush remaining buffer as content (no trailing newline)
    if (contentBuffer.current.length > 0 && !toolCtx) {
      yield { type: 'content', text: contentBuffer.current }
    } else if (contentBuffer.current.length > 0 && toolCtx) {
      for await (const c of processContentWithActions(
        contentBuffer.current + '\n',
        toolCtx,
        { current: '' },
        executedActionKeys
      )) {
        yield c
      }
    }
  })()

  const exitPromise = new Promise<void>((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Cursor CLI exited with code ${code}`))
      } else {
        resolve()
      }
    })
  })

  try {
    for await (const chunk of stream) {
      yield chunk
    }
  } finally {
    await exitPromise
  }
}

/**
 * Run Cursor Agent via CLI (non-streaming). Uses --output-format json and returns
 * the final result text.
 */
export async function runCursorCLI(
  messages: ChatMessage[],
  options?: CursorCLIRunOptions
): Promise<{ content: string }> {
  const prompt = messagesToSinglePrompt(messages)
  const model = (options?.model?.trim() || getCursorDefaultModel()).trim()
  const workspace = options?.workspace
  const env = { ...process.env, ...options?.env }

  const args = [
    'agent',
    '-p',
    '--output-format',
    'json',
    '--force',
    '--trust',
    '--model',
    model,
  ]
  if (workspace) {
    args.push('--workspace', workspace)
  }
  args.push(prompt)

  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)

  const execOpts: { env: NodeJS.ProcessEnv; encoding: BufferEncoding; maxBuffer: number; timeout: number; cwd?: string } = {
    env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
    timeout: 300_000,
  }
  if (workspace) {
    execOpts.cwd = workspace
  }
  let stdout = ''
  try {
    const result = await execFileAsync(getCursorCliPath(), args, execOpts)
    stdout = (result as { stdout: string }).stdout
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string }
    stdout = e.stdout ?? ''
    if (!stdout) throw err
  }

  try {
    const data = JSON.parse(stdout.trim()) as { result?: string; subtype?: string; is_error?: boolean }
    if (data.is_error || data.subtype !== 'success') {
      return { content: '' }
    }
    return { content: typeof data.result === 'string' ? data.result : '' }
  } catch {
    return { content: '' }
  }
}
