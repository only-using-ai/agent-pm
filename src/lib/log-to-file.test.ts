import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockInvoke = vi.fn()
const mockListen = vi.fn()
const mockIsTauri = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  isTauri: () => mockIsTauri(),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}))

describe('log-to-file', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockListen.mockResolvedValue(() => {})
  })
  afterEach(() => {
    // Restore console in case patch was applied
    vi.restoreAllMocks()
  })

  it('initLogToFile returns cleanup function when not Tauri', async () => {
    mockIsTauri.mockReturnValue(false)
    const { initLogToFile } = await import('./log-to-file')
    const cleanup = initLogToFile()
    expect(typeof cleanup).toBe('function')
    cleanup()
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(mockListen).not.toHaveBeenCalled()
  })

  it('initLogToFile calls listen and invoke when Tauri', async () => {
    mockIsTauri.mockReturnValue(true)
    mockInvoke.mockResolvedValue(false)
    const { initLogToFile } = await import('./log-to-file')
    const cleanup = initLogToFile()
    expect(mockListen).toHaveBeenCalledWith('log-to-file-changed', expect.any(Function))
    expect(mockInvoke).toHaveBeenCalledWith('get_log_to_file')
    cleanup()
  })

  it('when Tauri and get_log_to_file true, applyPatch is called and console.log invokes append_log_line', async () => {
    mockIsTauri.mockReturnValue(true)
    mockInvoke.mockResolvedValue(true)
    mockListen.mockResolvedValue(() => {})
    const { initLogToFile } = await import('./log-to-file')
    initLogToFile()
    await Promise.resolve()
    await Promise.resolve()
    console.log('test message')
    await Promise.resolve()
    expect(mockInvoke).toHaveBeenCalledWith('append_log_line', { level: 'log', message: 'test message' })
  })
})
