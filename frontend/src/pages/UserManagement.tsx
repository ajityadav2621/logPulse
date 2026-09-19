import { useState, useEffect } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BackendUser, AuditLogEntry } from '@/lib/api'
import { relativeTime } from '@/lib/utils'
import { listUsers, createUser, updateUserRole, deactivateUser, reactivateUser, listAuditLogs } from '@/lib/api'

const ROLES = [
  { role: 'Admin', permissions: 'Full access — manage users, settings, billing, and all data.' },
  { role: 'Editor', permissions: 'Can manage alerts, saved searches, and incidents. Cannot manage users.' },
  { role: 'Viewer', permissions: 'Read-only access to dashboards, logs, and reports.' },
]

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function UserManagement() {
  const [users, setUsers] = useState<BackendUser[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'viewer' as BackendUser['role'] })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [usersData, auditData] = await Promise.all([listUsers(), listAuditLogs()])
      setUsers(usersData)
      setAuditLogs(auditData)
    } catch (e) {
      console.error('Failed to load user management data', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return
    try {
      await createUser(inviteForm.name.trim(), inviteForm.email.trim(), inviteForm.role)
      setInviteOpen(false)
      setInviteForm({ name: '', email: '', role: 'viewer' })
      loadData()
    } catch (e) {
      console.error('Failed to invite user', e)
    }
  }

  async function handleRoleChange(id: number, role: BackendUser['role']) {
    try {
      await updateUserRole(id, role)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    } catch (e) {
      console.error('Failed to update role', e)
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await deactivateUser(id)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'deactivated' } : u)))
    } catch (e) {
      console.error('Failed to deactivate user', e)
    }
  }

  async function handleReactivate(id: number) {
    try {
      await reactivateUser(id)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'active' } : u)))
    } catch (e) {
      console.error('Failed to reactivate user', e)
    }
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage teammates, roles, and access."
        actions={<Button onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" /> Invite User</Button>}
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="w-9" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : users.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users found.</TableCell></TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8"><AvatarFallback>{initials(u.name)}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium leading-tight">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                        <TableCell><StatusBadge status={u.status} /></TableCell>
                        <TableCell className="text-muted-foreground">{u.last_login_at ? relativeTime(u.last_login_at) : '-'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'viewer' : 'admin')}>Toggle role</DropdownMenuItem>
                              {u.status === 'active' ? (
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeactivate(u.id)}>Deactivate user</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleReactivate(u.id)}>Reactivate user</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ROLES.map((r) => (
              <Card key={r.role}>
                <CardContent className="p-5">
                  <Badge variant="outline" className="mb-2">{r.role}</Badge>
                  <p className="text-sm text-muted-foreground">{r.permissions}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No audit logs found.</TableCell></TableRow>
                  ) : (
                    auditLogs.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">User {a.actor_id}</TableCell>
                        <TableCell className="text-muted-foreground">{a.action}</TableCell>
                        <TableCell className="text-muted-foreground">{a.detail}</TableCell>
                        <TableCell className="text-muted-foreground">{relativeTime(a.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="teammate@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as BackendUser['role'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}