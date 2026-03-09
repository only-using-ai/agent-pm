import { useCallback, useEffect, useState } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { Search, User, LogOut, Moon, Sun } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/contexts/theme-context'
import { CommandPalette } from '@/components/command-palette'

// Stub – replace with real user/session
const USER_NAME = 'Alex Johnson'

export function TopNav() {
  const { isDark, setTheme } = useTheme()
  const navigate = useNavigate()
  const [commandOpen, setCommandOpen] = useState(false)

  const openCommand = useCallback(() => setCommandOpen(true), [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="contents">
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />
        <img src="/logo.svg" alt="Agent PM" className="h-8 w-8 shrink-0" />
        <div className="flex flex-1 items-center gap-4">
          <h1 className="text-lg font-semibold truncate">Dashboard</h1>
          <button
            type="button"
            onClick={openCommand}
            className="hidden flex-1 max-w-sm md:flex items-center gap-2 rounded-lg border border-input bg-muted/50 px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Search className="size-4 shrink-0" />
            <span>Search...</span>
            <kbd className="ml-auto hidden rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
              ⌘K
            </kbd>
          </button>
        </div>
        <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent',
            'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none'
          )}
        >
          <User className="size-4" />
          <span className="sr-only">Open user menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium leading-none">{USER_NAME}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Signed in</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/profile')}>
            <User className="mr-2 size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LogOut className="mr-2 size-4" />
            Log out
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
              Dark mode
            </span>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </div>
  )
}
