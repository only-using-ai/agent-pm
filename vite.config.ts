/// <reference types="vitest" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// TAURI_ENV_PLATFORM is set when Tauri runs beforeBuildCommand; for dev we always use fixed port so Tauri can connect
const isTauri = !!process.env.TAURI_ENV_PLATFORM
const isTauriDev = process.env.TAURI_DEV_HOST != null

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true, // required for Tauri dev (must match devUrl)
    host: isTauriDev ? process.env.TAURI_DEV_HOST : false,
    proxy: {
      '/api': { target: 'http://localhost:38472', changeOrigin: true },
    },
    watch: isTauri || isTauriDev ? { ignored: ['**/src-tauri/**'] } : undefined,
    hmr: isTauriDev
      ? { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: isTauri
    ? {
        target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
      }
    : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'server/**/*.{test,spec}.ts'],
  },
})
