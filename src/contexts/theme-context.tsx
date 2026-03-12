/* eslint-disable react-refresh/only-export-components -- exports ThemeProvider and useTheme */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const STORAGE_KEY = 'agent-pm-theme'
const COLOR_THEME_STORAGE_KEY = 'agent-pm-color-theme'

export const COLOR_THEME_IDS = [
  'default',
  'zinc',
  'stone',
  'rose',
  'blue',
  'green',
  'orange',
  'violet',
  'amber',
  'slate',
] as const

export type ColorThemeId = (typeof COLOR_THEME_IDS)[number]

type Theme = 'light' | 'dark' | 'system'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

function applyTheme(effective: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', effective === 'dark')
}

function getStoredColorTheme(): ColorThemeId {
  if (typeof window === 'undefined') return 'default'
  const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY) as ColorThemeId | null
  return COLOR_THEME_IDS.includes(stored as ColorThemeId) ? (stored as ColorThemeId) : 'default'
}

function applyColorThemeToDocument(id: ColorThemeId) {
  if (id === 'default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', id)
  }
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark'
  isDark: boolean
  colorTheme: ColorThemeId
  previewColorTheme: (id: ColorThemeId) => void
  saveColorTheme: (id: ColorThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    getEffectiveTheme(getStoredTheme())
  )
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(getStoredColorTheme)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const previewColorTheme = useCallback((id: ColorThemeId) => {
    applyColorThemeToDocument(id)
  }, [])

  const saveColorTheme = useCallback((id: ColorThemeId) => {
    setColorThemeState(id)
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, id)
    applyColorThemeToDocument(id)
  }, [])

  useEffect(() => {
    const effective = getEffectiveTheme(theme)
    queueMicrotask(() => setEffectiveTheme(effective))
    applyTheme(effective)
  }, [theme])

  useEffect(() => {
    applyColorThemeToDocument(colorTheme)
  }, [colorTheme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handle = () => {
      const effective = getSystemTheme()
      setEffectiveTheme(effective)
      applyTheme(effective)
    }
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      effectiveTheme,
      isDark: effectiveTheme === 'dark',
      colorTheme,
      previewColorTheme,
      saveColorTheme,
    }),
    [theme, setTheme, effectiveTheme, colorTheme, previewColorTheme, saveColorTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
