/**
 * Shared dependencies for route modules. Injected so routes stay testable
 * and the server entry only wires app, middleware, hooks, and mount.
 */

import type { Pool } from 'pg'
import type { SseBroadcaster } from '../services/sse.service.js'

export type RouteDeps = {
  getPool: () => Pool
  sse: SseBroadcaster
  emit: (event: string, payload: unknown) => void
  upload: { single: (name: string) => import('express').RequestHandler }
}
