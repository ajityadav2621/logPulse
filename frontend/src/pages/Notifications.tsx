import { useState, useEffect } from 'react'
import { Server, AlertTriangle, Cpu, MemoryStick, Flame, Check } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { Notification } from '@/lib/api'
import { relativeTime, cn } from '@/lib/utils'
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/api'

const ICONS: Record<string, any> = {
  alert: AlertTriangle,
  system: Server,
  account: Cpu,
}

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    try {
      const data = await listNotifications()
      setItems(data)
    } catch (e) {
      console.error('Failed to load notifications', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await markNotificationRead(id)
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch (e) {
      console.error('Failed to mark notification read', e)
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (e) {
      console.error('Failed to mark all notifications read', e)
    }
  }

  const unread = items.filter((n) => !n.read)
  const read = items.filter((n) => n.read)

  function List({ list }: { list: Notification[] }) {
    if (list.length === 0) return <EmptyState title="Nothing here" description="You're all caught up." />
    return (
      <div className="space-y-2">
        {list.map((n) => {
          const Icon = ICONS[n.type] || AlertTriangle
          return (
            <Card key={n.id} className={cn(!n.read && 'border-primary/30 bg-primary/5')}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{relativeTime(n.created_at)}</p>
                </div>
                {!n.read && (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>
                    <Check className="h-4 w-4" /> Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System alerts for downtime, failures, and resource thresholds."
        actions={<Button variant="outline" onClick={handleMarkAllRead}>Mark all as read</Button>}
      />

      <Tabs defaultValue="unread">
        <TabsList>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
          <TabsTrigger value="read">Read ({read.length})</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="unread"><List list={unread} /></TabsContent>
        <TabsContent value="read"><List list={read} /></TabsContent>
        <TabsContent value="all"><List list={items} /></TabsContent>
      </Tabs>
    </div>
  )
}