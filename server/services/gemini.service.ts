/**
 * Gemini service: list models for the Gemini CLI provider.
 * Uses the known model aliases from https://geminicli.com/docs/cli/cli-reference/
 * and optionally verifies the CLI is available via `gemini --version`.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getGeminiCliPath } from '../config.js'

const execFileAsync = promisify(execFile)

/** Model aliases from Gemini CLI docs (auto, pro, flash, flash-lite). */
const GEMINI_MODEL_ALIASES = ['auto', 'pro', 'flash', 'flash-lite']

export type GeminiModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string; detail?: string }

/**
 * Fetch Gemini CLI models. Returns the standard aliases; if the CLI is not
 * found or fails, returns an error so the UI can show a message.
 */
export async function fetchGeminiModels(): Promise<GeminiModelsResult> {
  const cliPath = getGeminiCliPath()
  const execOpts = {
    encoding: 'utf8' as const,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env },
  }
  try {
    await execFileAsync(cliPath, ['--version'], execOpts)
    return { ok: true, models: [...GEMINI_MODEL_ALIASES] }
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT' || (e as { killed?: boolean })?.killed) {
      return {
        ok: false,
        error: 'Gemini CLI not found. Install it and ensure "gemini" is on PATH.',
        detail: err.message,
      }
    }
    return {
      ok: false,
      error: 'Failed to run Gemini CLI',
      detail: err.message ?? String(e),
    }
  }
}
