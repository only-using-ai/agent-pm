/**
 * Anthropic (Claude) service: fetch available models from Anthropic API.
 * Uses ANTHROPIC_API_KEY. See https://docs.anthropic.com/en/api/models
 */

const MODELS_URL = 'https://api.anthropic.com/v1/models'
const ANTHROPIC_VERSION = '2023-06-01'

export type AnthropicModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string; detail?: string }

export async function fetchAnthropicModels(options?: {
  apiKey?: string
}): Promise<AnthropicModelsResult> {
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return { ok: false, error: 'Anthropic API key required. Set ANTHROPIC_API_KEY.' }
  }

  try {
    const resp = await fetch(MODELS_URL, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
    })
    if (!resp.ok) {
      const text = await resp.text()
      return {
        ok: false,
        error: 'Failed to fetch Anthropic models',
        detail: text || resp.statusText,
      }
    }
    const data = (await resp.json()) as { data?: { id: string }[] }
    const models = (data.data ?? []).map((m) => m.id).filter(Boolean)
    return { ok: true, models }
  } catch (e) {
    return {
      ok: false,
      error: 'Cannot reach Anthropic API.',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}
