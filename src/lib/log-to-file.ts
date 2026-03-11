/**
 * When running in the Tauri desktop app, supports Help > "Log to file":
 * - If enabled, console.log/warn/error are also appended to a log file.
 * - The setting is persisted and can be toggled from the native Help menu.
 */

import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

function serializeArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a === null) return 'null'
      if (a === undefined) return 'undefined'
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')
}

let patched = false
let originalLog: typeof console.log
let originalWarn: typeof console.warn
let originalError: typeof console.error

function applyPatch(): void {
  if (patched) return
  originalLog = console.log
  originalWarn = console.warn
  originalError = console.error
  console.log = (...args: unknown[]) => {
    originalLog.apply(console, args)
    invoke('append_log_line', { level: 'log', message: serializeArgs(args) }).catch(() => {})
  }
  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args)
    invoke('append_log_line', { level: 'warn', message: serializeArgs(args) }).catch(() => {})
  }
  console.error = (...args: unknown[]) => {
    originalError.apply(console, args)
    invoke('append_log_line', { level: 'error', message: serializeArgs(args) }).catch(() => {})
  }
  patched = true
}

function removePatch(): void {
  if (!patched) return
  console.log = originalLog
  console.warn = originalWarn
  console.error = originalError
  patched = false
}

export function initLogToFile(): () => void {
  if (!isTauri()) return () => {}

  let unlisten: (() => void) | null = null
  listen<boolean>('log-to-file-changed', (e) => {
    if (e.payload) applyPatch()
    else removePatch()
  }).then((fn) => {
    unlisten = fn
  }).catch(() => {})

  invoke<boolean>('get_log_to_file')
    .then((enabled) => {
      if (enabled) applyPatch()
    })
    .catch(() => {})

  return () => {
    removePatch()
    unlisten?.()
  }
}
