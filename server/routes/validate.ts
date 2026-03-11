/**
 * Request validation at the route layer using Zod.
 * Use validateBody, validateParams, or validateQuery middleware so handlers
 * receive typed, validated data; invalid requests get 400 with a consistent message.
 */

import type { Request, Response, NextFunction } from 'express'
import type { z } from 'zod'
import { badRequest } from '../errors.js'

function formatZodError(error: z.ZodError): string {
  const parts = error.errors.map((e) => {
    const path = e.path.length ? e.path.join('.') + ': ' : ''
    return path + e.message
  })
  return parts.length > 0 ? parts.join('; ') : 'Validation failed'
}

/**
 * Middleware that parses and validates req.body with the given Zod schema.
 * On success, replaces req.body with the parsed value. On failure, calls next(badRequest(...)).
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (result.success) {
      req.body = result.data
      next()
      return
    }
    next(badRequest(formatZodError(result.error)))
  }
}

/**
 * Middleware that parses and validates req.params with the given Zod schema.
 * On success, replaces req.params with the parsed value. On failure, calls next(badRequest(...)).
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params)
    if (result.success) {
      req.params = result.data as Record<string, string>
      next()
      return
    }
    next(badRequest(formatZodError(result.error)))
  }
}

/**
 * Middleware that parses and validates req.query with the given Zod schema.
 * On success, assigns the parsed value to req.query (so handlers see typed query).
 * On failure, calls next(badRequest(...)).
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (result.success) {
      req.query = result.data as Record<string, string | string[] | undefined>
      next()
      return
    }
    next(badRequest(formatZodError(result.error)))
  }
}
