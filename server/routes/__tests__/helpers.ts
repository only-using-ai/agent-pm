import express, { type Express } from 'express'
import type { Pool } from 'pg'
import type { SseBroadcaster } from '../../services/sse.service.js'
import type { RouteDeps } from '../types.js'
import { errorMiddleware } from '../../errors.js'

/**
 * Create a mock Pool that returns a vi.fn() for query. Caller should set mockQuery.mockResolvedValue.
 */
export function createMockPool(mockQuery: ReturnType<typeof import('vitest').vi.fn>): Pool {
  return { query: mockQuery } as unknown as Pool
}

/**
 * Create mock getPool that returns the given pool.
 */
export function createMockGetPool(pool: Pool): () => Pool {
  return () => pool
}

/**
 * Create mock SSE broadcaster for route tests (no-op methods).
 */
export function createMockSse(): SseBroadcaster {
  return {
    broadcastToAgent: () => {},
    registerAgentStream: () => {},
    registerStreamStatus: () => {},
  }
}

/**
 * Create mock emit function (no-op, can be asserted with vi.fn()).
 */
export function createMockEmit(): (event: string, payload: unknown) => void {
  return () => {}
}

/**
 * Create mock upload middleware that optionally sets req.file and calls next().
 * Use with (req, res, next) => { req.file = { ... }; next(); } for upload tests.
 */
export function createMockUpload(
  file?: { buffer: Buffer; originalname: string; mimetype: string }
): RouteDeps['upload'] {
  const single = (_field: string) => {
    return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      if (file) (req as express.Request & { file?: typeof file }).file = file
      next()
    }
  }
  return { single }
}

/**
 * Build an Express app with json, the given router mounted at path, and error middleware
 * so that next(err) returns JSON { error } (and optional detail) instead of HTML.
 */
export function appWithRouter(path: string, router: import('express').Router): Express {
  const app = express()
  app.use(express.json())
  app.use(path, router)
  app.use(errorMiddleware)
  return app
}

/** Get JSON body from response; supertest often leaves res.body empty for 4xx/5xx, so parse res.text. */
export function responseBody(res: { body?: unknown; text?: string }): Record<string, unknown> {
  const body = res.body
  if (body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body as object).length > 0) {
    return body as Record<string, unknown>
  }
  const text = (res as { text?: string }).text ?? ''
  if (text.length > 0) {
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}
