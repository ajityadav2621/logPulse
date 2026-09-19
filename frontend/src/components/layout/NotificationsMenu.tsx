import { Bell, Server, AlertTriangle, Cpu, MemoryStick, Flame } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Notification } from '@/lib/api'
import { relativeTime, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { listNotifications } from '@/lib/api'

const ICONS: Record<string, any> = {
  alert: AlertTriangle,
  system: Server,
  account: Cpu,
}

export function NotificationsMenu() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listNotifications().then(setNotifications).catch(console.error).finally(() => setLoading(false))
  }, [])

  const items = notifications.slice(0, 6)
  const unread = notifications.filter((n) => !n.read).length

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
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No notifications</div>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.type] || Bell
              return (
                <div key={n.id} className={cn('flex gap-2.5 rounded-md px-2 py-2 text-sm', !n.read && 'bg-accent/60')}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="ml-auto mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
              )
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <Link to="/notifications" className="block px-2 py-1.5 text-center text-xs font-medium text-primary hover:underline">
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}