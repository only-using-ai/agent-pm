/**
 * Gemini CLI runner: runs the Gemini agent via the local CLI.
 * Spawns `gemini -p "..." --output-format stream-json --model <id>` and parses NDJSON
 * to stream content, thinking (when present), and optional tool_call chunks.
 *
 * Docs: https://geminicli.com/docs/cli/cli-reference/
 *
 * Uses the same __AGENT_ACTION__ line format as Cursor CLI for work-item tools when
 * toolContext is provided.
 */

import { spawn } from 'node:child_process'
import type { StreamChunk, ChatMessage } from './types.js'
import type { WorkItemToolContext } from './langchain-tools.js'
import { getGeminiCliPath, getGeminiDefaultModel, getEnvWithNodeInPath } from '../config.js'
import {
  processContentWithActions,
  messagesToSinglePrompt,
} from './cursor-cli-runner.js'

export type GeminiCLIRunOptions = {
  model?: string | null
  /** Working directory (cwd) for the CLI. */
  workspace?: string
  /** Extra env. */
  env?: NodeJS.ProcessEnv
  /**
   * When set, assistant content is scanned for __AGENT_ACTION__ lines and
   * executed as work-item tools (same format as Cursor CLI).
   */
  toolContext?: WorkItemToolContext
}

/**
 * Run Gemini via CLI and stream NDJSON events as StreamChunk.
 * Uses --output-format stream-json for real-time content. Parses thought/result
 * and assistant-style events; maps content through __AGENT_ACTION__ when toolContext is set.
 */
export async function* runGeminiCLIStream(
  messages: ChatMessage[],
  options?: GeminiCLIRunOptions
): AsyncIterable<StreamChunk> {
  const prompt = messagesToSinglePrompt(messages)
  const model = (options?.model?.trim() || getGeminiDefaultModel()).trim()
  const workspace = options?.workspace
  const env = { ...getEnvWithNodeInPath(), ...options?.env }

  const args = ['-p', prompt, '--output-format', 'stream-json', '--model', model]
  const spawnOpts: { env: NodeJS.ProcessEnv; stdio: ('ignore' | 'pipe')[]; shell?: boolean; cwd?: string } = {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  }
  if (workspace) {
    spawnOpts.cwd = workspace
  }
  const proc = spawn(getGeminiCliPath(), args, spawnOpts)

  let buffer = ''
  const stdout = proc.stdout
  const stderr = proc.stderr
  if (!stdout || !stderr) {
    throw new Error('Gemini CLI spawn failed: no stdout/stderr')
  }

  stderr.on('data', (chunk: Buffer) => {
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
          const type = (event.type as string) ?? (event.event as string)

          // Thought / reasoning (Gemini CLI may emit "thought" events)
          if (type === 'thought' || type === 'thinking' || type === 'reasoning') {
            const text =
              typeof event.content === 'string'
                ? event.content
                : typeof event.text === 'string'
                  ? event.text
                  : typeof event.reasoning === 'string'
                    ? event.reasoning
                    : typeof event.thinking === 'string'
                      ? event.thinking
                      : ''
            if (text) yield { type: 'thinking', text }
            continue
          }

          // Assistant / result with content blocks (Cursor-like or Gemini-like)
          const msg = event.message ?? event.result ?? event
          const content = (msg as { content?: unknown }).content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (!block || typeof block !== 'object') continue
              const b = block as { type?: string; text?: string; reasoning?: string; thinking?: string }
              const isReasoning =
                b.type === 'reasoning' || b.type === 'thinking' || b.type === 'thought'
              if (isReasoning) {
                const t =
                  typeof b.reasoning === 'string'
                    ? b.reasoning
                    : typeof b.thinking === 'string'
                      ? b.thinking
                      : typeof b.text === 'string'
                        ? b.text
                        : ''
                if (t) yield { type: 'thinking', text: t }
                continue
              }
              if (b.type === 'text' && typeof b.text === 'string' && b.text) {
                if (toolCtx) {
                  for await (const c of processContentWithActions(
                    b.text,
                    toolCtx,
                    contentBuffer,
                    executedActionKeys
                  )) {
                    yield c
                  }
                } else {
                  yield { type: 'content', text: b.text }
                }
              }
            }
            continue
          }

          // Single text/result field
          const singleText =
            typeof (msg as { text?: string }).text === 'string'
              ? (msg as { text: string }).text
              : typeof (event as { text?: string }).text === 'string'
                ? (event as { text: string }).text
                : typeof (event as { result?: string }).result === 'string'
                  ? (event as { result: string }).result
                  : ''
          if (singleText) {
            if (toolCtx) {
              for await (const c of processContentWithActions(
                singleText,
                toolCtx,
                contentBuffer,
                executedActionKeys
              )) {
                yield c
              }
            } else {
              yield { type: 'content', text: singleText }
            }
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
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
        reject(new Error(`Gemini CLI exited with code ${code}`))
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
 * Run Gemini via CLI (non-streaming). Uses --output-format json and returns
 * the final result text.
 */
export async function runGeminiCLI(
  messages: ChatMessage[],
  options?: GeminiCLIRunOptions
): Promise<{ content: string }> {
  const prompt = messagesToSinglePrompt(messages)
  const model = (options?.model?.trim() || getGeminiDefaultModel()).trim()
  const workspace = options?.workspace
  const env = { ...getEnvWithNodeInPath(), ...options?.env }

  const args = ['-p', prompt, '--output-format', 'json', '--model', model]
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
    const result = await execFileAsync(getGeminiCliPath(), args, execOpts)
    stdout = (result as { stdout: string }).stdout
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string }
    stdout = e.stdout ?? ''
    if (!stdout) throw err
  }

  try {
    const data = JSON.parse(stdout.trim()) as {
      result?: string
      content?: string
      text?: string
      subtype?: string
      is_error?: boolean
    }
    if (data.is_error || data.subtype === 'error') {
      return { content: '' }
    }
    const content =
      typeof data.result === 'string'
        ? data.result
        : typeof data.content === 'string'
          ? data.content
          : typeof data.text === 'string'
            ? data.text
            : ''
    return { content }
  } catch {
    return { content: '' }
  }
}
