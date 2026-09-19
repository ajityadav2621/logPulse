import { useNavigate } from 'react-router-dom'
import { Menu, Search, Sun, Moon, LogOut, UserCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd, SEARCH_SHORTCUT_ARIA, SEARCH_SHORTCUT_LABEL } from '@/components/search/CommandPalette'
import { useTheme } from '@/lib/theme-provider'
import { useAuth } from '@/lib/auth-context'
import { NotificationsMenu } from './NotificationsMenu'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'
}

export function Topbar({
  onMenuClick,
  onLogout,
  onOpenSearch,
}: {
  onMenuClick: () => void
  onLogout: () => void
  onOpenSearch: () => void
}) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Trigger only — the real interaction lives in the command palette
          (also openable with ⌘K / Ctrl+K anywhere). */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts={SEARCH_SHORTCUT_ARIA}
        aria-label="Open search"
        className="hidden h-9 w-full max-w-md flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search logs…</span>
        <Kbd className="ml-auto">{SEARCH_SHORTCUT_LABEL}</Kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={onOpenSearch}
        aria-label="Open search"
      >
        <Search className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <NotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8">
              {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
              <AvatarFallback>{initials(user?.name ?? 'U')}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{user?.name ?? 'Account'}</div>
              <div className="text-xs font-normal text-muted-foreground">{user?.email ?? ''}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserCircle className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
