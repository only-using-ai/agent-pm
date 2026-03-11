/**
 * Standardized error handling for the API: response shape and information disclosure.
 * - Use AppError (or helpers) for known client-facing errors; throw or pass to next().
 * - Unknown errors become 500 with a generic message (internal details are logged, not sent).
 */

import type { Request, Response, NextFunction } from 'express'

/** HTTP status codes we use for API errors */
export const HTTP = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
} as const

/**
 * Application error with a safe client message and HTTP status.
 * Only message (and optional detail) are sent to the client; stack/logging is server-only.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly detail?: string
  ) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export function badRequest(message: string): AppError {
  return new AppError(HTTP.BAD_REQUEST, message)
}

export function notFound(message: string): AppError {
  return new AppError(HTTP.NOT_FOUND, message)
}

export function internal(message: string = 'An unexpected error occurred'): AppError {
  return new AppError(HTTP.INTERNAL, message)
}

export function badGateway(message: string, detail?: string): AppError {
  return new AppError(HTTP.BAD_GATEWAY, message, detail)
}

/** Standard JSON shape for all API error responses (frontend expects { error } and optionally detail). */
export type ErrorResponseBody = { error: string; detail?: string }

function sendErrorResponse(res: Response, statusCode: number, body: ErrorResponseBody): void {
  if (!res.headersSent) {
    res.status(statusCode).json(body)
  }
}

/**
 * Express error middleware. Call next(err) from route handlers (or use asyncHandler).
 * - AppError → statusCode and { error, detail? }; no stack or internal message to client.
 * - Other errors → log server-side, respond 500 with generic message to avoid information disclosure.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ErrorResponseBody = { error: err.message }
    if (err.detail !== undefined) body.detail = err.detail
    sendErrorResponse(res, err.statusCode, body)
    return
  }

  const genericMessage = 'An unexpected error occurred'
  const statusCode = HTTP.INTERNAL

  if (err instanceof Error) {
    console.error('[api]', err.message, err.stack)
  } else {
    console.error('[api]', err)
  }

  sendErrorResponse(res, statusCode, { error: genericMessage })
}

/**
 * Wraps an async route handler so rejections are passed to next(err) and handled by errorMiddleware.
 * Use so route handlers can throw AppError (or any Error) instead of try/catch + res.status().json().
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
