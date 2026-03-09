import { useEffect, useState } from 'react'

const MODEL_ENDPOINTS: Record<string, string> = {
  ollama: '/api/ollama/models',
  cursor: '/api/cursor/models',
  anthropic: '/api/anthropic/models',
}

export function useProviderModels(provider: string) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const endpoint = MODEL_ENDPOINTS[provider?.toLowerCase() ?? '']
    if (!endpoint) {
      setModels([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          setModels([])
        } else {
          setModels(data.models ?? [])
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load models')
          setModels([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [provider])

  return { models, loading, error }
}
