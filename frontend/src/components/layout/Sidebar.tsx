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
} from 'lucide-react'
import { Logo } from './Logo'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/live-logs', label: 'Live Logs', icon: Radio },
  { to: '/applications', label: 'Applications', icon: AppWindow },
  { to: '/servers', label: 'Servers', icon: Server },
  { to: '/alerts', label: 'Alerts', icon: BellRing },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/saved-searches', label: 'Saved Searches', icon: Bookmark },
  { to: '/incidents', label: 'Incidents', icon: ShieldAlert },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/users', label: 'Users', icon: Users },
]

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

export function Sidebar({ onLogout, className }: { onLogout: () => void; className?: string }) {
  const navigate = useNavigate()

  return (
    <aside className={cn('flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar', className)}>
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Logo />
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback>AS</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">Aditi Sharma</p>
                <p className="truncate text-xs text-sidebar-foreground/60">Admin</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">Aditi Sharma</p>
              <p className="text-xs font-normal text-muted-foreground">aditi.sharma@logpulse.io</p>
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