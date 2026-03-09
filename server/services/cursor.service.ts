/**
 * Cursor service: list models from the Cursor API (when API key is set) or from
 * the locally installed Cursor CLI ("cursor agent models"). See:
 * https://cursor.com/docs/cli/overview
 * https://cursor.com/docs/cloud-agent/api/endpoints (GET /v0/models)
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const CURSOR_API_BASE = 'https://api.cursor.com'

export type CursorModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string; detail?: string }

/**
 * Fetch model IDs from Cursor Cloud Agents API (GET /v0/models).
 * Uses Basic auth per https://cursor.com/docs/api.md.
 * Returns the same model IDs accepted by Cursor for chat/agents.
 */
export async function fetchCursorModelsFromApi(apiKey: string): Promise<CursorModelsResult> {
  const url = `${CURSOR_API_BASE}/v0/models`
  const auth = Buffer.from(`${apiKey}:`, 'utf8').toString('base64')
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text()
      return {
        ok: false,
        error: `Cursor API ${res.status}`,
        detail: text || res.statusText,
      }
    }
    const data = (await res.json()) as { models?: string[] }
    const models = Array.isArray(data?.models) ? data.models : []
    return { ok: true, models }
  } catch (e) {
    const err = e as Error
    return {
      ok: false,
      error: 'Failed to fetch Cursor models',
      detail: err.message ?? String(e),
    }
  }
}

/** Strip ANSI escape sequences (e.g. [2K, [G, [1A). */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]?[^\x1b]*/g, '')
}

/** Model id: alphanumeric, hyphens, dots (e.g. auto, gpt-5.3-codex-low, opus-4.6-thinking). */
const MODEL_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/

/**
 * Parse "cursor agent models" output: lines like "model-id - Display Name (current)".
 * Uses " - " (space hyphen space) as separator and strips ANSI before parsing.
 */
function parseModelsOutput(raw: string): string[] {
  const text = stripAnsi(raw)
  const models: string[] = []
  const seen = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    const dashIndex = trimmed.indexOf(' - ')
    if (dashIndex === -1) continue
    const id = trimmed.slice(0, dashIndex).trim()
    if (id && MODEL_ID_REGEX.test(id) && !seen.has(id)) {
      seen.add(id)
      models.push(id)
    }
  }
  return models
}

/**
 * Fetch Cursor models: when apiKey is set, use GET /v0/models first (returns IDs
 * valid for Cursor's API). Otherwise fall back to CLI "cursor agent models".
 */
export async function fetchCursorModels(apiKey?: string): Promise<CursorModelsResult> {
  const key = apiKey ?? process.env.CURSOR_API_KEY
  if (key?.trim()) {
    const apiResult = await fetchCursorModelsFromApi(key.trim())
    if (apiResult.ok && apiResult.models.length > 0) return apiResult
    if (apiResult.ok) {
      // API returned empty list; fall through to CLI
    } else {
      // API failed; fall through to CLI so UI still gets CLI list if available
    }
  }
  const execOpts = {
    encoding: 'utf8' as const,
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    env: { ...process.env },
  }
  try {
    const { stdout, stderr } = await execAsync('cursor agent models', execOpts)
    const combined = [stdout, stderr].filter(Boolean).join('\n')
    const models = parseModelsOutput(combined)
    return { ok: true, models }
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    const combined = [err.stdout, err.stderr].filter(Boolean).join('\n')
    if (combined) {
      const models = parseModelsOutput(combined)
      if (models.length > 0) return { ok: true, models }
    }
    if (err.code === 'ENOENT' || (err as any)?.killed) {
      return {
        ok: false,
        error: 'Cursor CLI not found. Install Cursor and ensure "cursor" is on PATH.',
        detail: err.message,
      }
    }
    return {
      ok: false,
      error: 'Failed to run cursor agent models',
      detail: err.message ?? String(e),
    }
  }
}
