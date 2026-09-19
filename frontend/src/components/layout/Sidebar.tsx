import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ScrollText,
  Radio,
  AppWindow,
  Server,
  BellRing,
  BarChart3,
  Bookmark,
  ShieldAlert,
  FileBarChart,
  Users,
  Settings,
  UserCircle,
  LogOut,
  ChevronsUpDown,
  Sparkles,
} from 'lucide-react'
import { Logo } from './Logo'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: any }[] }[] = [
  {
    label: 'Monitoring',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/logs', label: 'Logs', icon: ScrollText },
      { to: '/live-logs', label: 'Live Logs', icon: Radio },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/incidents', label: 'Incidents', icon: ShieldAlert },
      { to: '/alerts', label: 'Alerts', icon: BellRing },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/applications', label: 'Applications', icon: AppWindow },
      { to: '/servers', label: 'System Health', icon: Server },
      { to: '/saved-searches', label: 'Saved Searches', icon: Bookmark },
      { to: '/reports', label: 'Reports', icon: FileBarChart },
      { to: '/users', label: 'Users', icon: Users },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'
}

export function Sidebar({ onLogout, className }: { onLogout: () => void; className?: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <aside className={cn('flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar', className)}>
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Logo />
      </div>

      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AI monitoring active
          </p>
          <p className="mt-1 text-[11px] leading-snug text-sidebar-foreground/60">
            Clustering, anomaly detection, and correlation run in the background — findings land in Incidents.
          </p>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
              <Avatar className="h-8 w-8 shrink-0">
                {user?.avatar_url ? <AvatarImage src={user.avatar_url} /> : null}
                <AvatarFallback>{initials(user?.name ?? 'User')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">{user?.name ?? 'Account'}</p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/60">{user?.role ?? ''}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
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
    </aside>
  )
}

export { NAV_ITEMS }
