import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useTheme,
  COLOR_THEME_IDS,
  type ColorThemeId,
} from '@/contexts/theme-context'

const THEME_LABELS: Record<ColorThemeId, string> = {
  default: 'Default',
  zinc: 'Zinc',
  stone: 'Stone',
  rose: 'Rose',
  blue: 'Blue',
  green: 'Green',
  orange: 'Orange',
  violet: 'Violet',
  amber: 'Amber',
  slate: 'Slate',
}

/* Preview swatch colors (oklch) for each theme, light and dark, for the small cards */
const PREVIEW_COLORS: Record<
  ColorThemeId,
  { light: { primary: string; muted: string }; dark: { primary: string; muted: string } }
> = {
  default: {
    light: { primary: 'oklch(0.205 0 0)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.87 0 0)', muted: 'oklch(0.269 0 0)' },
  },
  zinc: {
    light: { primary: 'oklch(0.207 0.006 247.896)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.931 0.012 247.896)', muted: 'oklch(0.269 0 0)' },
  },
  stone: {
    light: { primary: 'oklch(0.278 0.013 56.043)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.908 0.014 73.684)', muted: 'oklch(0.269 0 0)' },
  },
  rose: {
    light: { primary: 'oklch(0.396 0.141 353.717)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.704 0.191 22.216)', muted: 'oklch(0.269 0 0)' },
  },
  blue: {
    light: { primary: 'oklch(0.488 0.243 264.376)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.704 0.191 252.894)', muted: 'oklch(0.269 0 0)' },
  },
  green: {
    light: { primary: 'oklch(0.398 0.128 164.364)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.696 0.17 162.48)', muted: 'oklch(0.269 0 0)' },
  },
  orange: {
    light: { primary: 'oklch(0.558 0.202 47.708)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.769 0.188 70.08)', muted: 'oklch(0.269 0 0)' },
  },
  violet: {
    light: { primary: 'oklch(0.488 0.243 276.966)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.627 0.265 303.9)', muted: 'oklch(0.269 0 0)' },
  },
  amber: {
    light: { primary: 'oklch(0.585 0.202 84.429)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.828 0.189 84.429)', muted: 'oklch(0.269 0 0)' },
  },
  slate: {
    light: { primary: 'oklch(0.278 0.025 264.695)', muted: 'oklch(0.97 0 0)' },
    dark: { primary: 'oklch(0.704 0.04 256.788)', muted: 'oklch(0.269 0 0)' },
  },
}

function ThemePreviewCard({
  themeId,
  label,
  isSelected,
  isDark,
  onSelect,
}: {
  themeId: ColorThemeId
  label: string
  isSelected: boolean
  isDark: boolean
  onSelect: () => void
}) {
  const colors = PREVIEW_COLORS[themeId][isDark ? 'dark' : 'light']
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col rounded-lg border-2 p-2 text-left transition-colors w-full min-w-0',
        'hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0',
        isSelected ? 'border-primary ring-2 ring-inset ring-primary/20' : 'border-border'
      )}
      aria-pressed={isSelected}
      aria-label={`Select ${label} theme`}
    >
      <div className="flex gap-1 rounded-md overflow-hidden h-10 mb-2">
        <span
          className="flex-1 min-w-0 rounded-sm"
          style={{ backgroundColor: colors.primary }}
        />
        <span
          className="w-6 shrink-0 rounded-sm"
          style={{ backgroundColor: colors.muted }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{label}</span>
        {isSelected && (
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
        )}
      </div>
    </button>
  )
}

export function PreferencesPage() {
  const { colorTheme, previewColorTheme, saveColorTheme, isDark } = useTheme()
  const [selectedTheme, setSelectedTheme] = useState<ColorThemeId>(colorTheme)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSelectedTheme(colorTheme)
  }, [colorTheme])

  useEffect(() => {
    return () => {
      previewColorTheme(colorTheme)
    }
  }, [colorTheme, previewColorTheme])

  const handleSelectTheme = (id: ColorThemeId) => {
    setSelectedTheme(id)
    previewColorTheme(id)
  }

  const handleSave = () => {
    saveColorTheme(selectedTheme)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize appearance and behavior. Changes to color theme apply
            immediately; click Save to keep your selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Color theme</h2>
            <p className="text-sm text-muted-foreground">
              Choose a color theme for the app. Works in both light and dark
              mode.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {COLOR_THEME_IDS.map((id) => (
                <ThemePreviewCard
                  key={id}
                  themeId={id}
                  label={THEME_LABELS[id]}
                  isSelected={selectedTheme === id}
                  isDark={isDark}
                  onSelect={() => handleSelectTheme(id)}
                />
              ))}
            </div>
          </section>
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleSave}>{saved ? 'Saved' : 'Save'}</Button>
          {saved && (
            <span className="text-sm text-muted-foreground">Theme saved.</span>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
