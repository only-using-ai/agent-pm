/**
 * Ollama service: fetch available models from an Ollama server.
 * Single responsibility; base URL is injectable for testability.
 */

const DEFAULT_BASE = 'http://localhost:11434'

export type OllamaModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string; detail?: string }

export async function fetchOllamaModels(
  baseUrl: string = DEFAULT_BASE
): Promise<OllamaModelsResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/tags`
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      const text = await resp.text()
      return {
        ok: false,
        error: 'Failed to fetch Ollama models',
        detail: text || resp.statusText,
      }
    }
    const data = (await resp.json()) as { models?: { name: string }[] }
    const models = (data.models ?? []).map((m) => m.name)
    return { ok: true, models }
  } catch (e) {
    return {
      ok: false,
      error: 'Cannot reach Ollama. Is it running?',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}
