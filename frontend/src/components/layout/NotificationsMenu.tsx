import { Bell, Server, AlertTriangle, Cpu, MemoryStick, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NOTIFICATIONS } from '@/lib/mock-data'
import { relativeTime, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

const ICONS: Record<string, any> = {
  'Server Down': Server,
  'API Failure': AlertTriangle,
  'High CPU': Cpu,
  'High Memory': MemoryStick,
  'High Error Rate': Flame,
}

export function NotificationsMenu({ unread }: { unread: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-level-error" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && <span className="text-xs font-normal text-muted-foreground">{unread} unread</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="scrollbar-thin max-h-80 overflow-y-auto">
          {NOTIFICATIONS.slice(0, 6).map((n) => {
            const Icon = ICONS[n.type] ?? Bell
            return (
              <div key={n.id} className={cn('flex gap-2.5 rounded-md px-2 py-2 text-sm', !n.read && 'bg-accent/60')}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{n.type}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.read && <span className="ml-auto mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </div>
            )
          })}
        </div>
        <DropdownMenuSeparator />
        <Link to="/notifications" className="block px-2 py-1.5 text-center text-xs font-medium text-primary hover:underline">
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}