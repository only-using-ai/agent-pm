/**
 * Server config: default port is chosen to avoid conflicts with common dev tools.
 * Override with PORT or AGENT_PM_PORT.
 */
export const DEFAULT_PORT = 38_472

export function getServerPort(): number {
  const env = process.env.AGENT_PM_PORT ?? process.env.PORT
  if (env != null && env !== '') {
    const n = Number(env)
    if (Number.isInteger(n) && n > 0 && n < 65536) return n
  }
  return DEFAULT_PORT
}
