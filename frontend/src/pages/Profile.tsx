import { useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTheme } from '@/lib/theme-provider'

const API_KEYS = [
  { id: 'k1', name: 'CI Pipeline', prefix: 'lp_live_4f2a...9c1', created: '32 days ago' },
  { id: 'k2', name: 'Local Dev', prefix: 'lp_test_88bd...e02', created: '5 days ago' },
]

const SESSIONS = [
  { id: 's1', device: 'Chrome on macOS', location: 'Mumbai, IN', current: true },
  { id: 's2', device: 'Safari on iOS', location: 'Mumbai, IN', current: false },
]

export default function Profile() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <PageHeader title="Profile" description="Your account details and personal preferences." />

      <div className="mb-4 flex items-center gap-4">
        <Avatar className="h-16 w-16"><AvatarFallback className="text-xl">AS</AvatarFallback></Avatar>
        <div>
          <p className="text-lg font-semibold">Aditi Sharma</p>
          <p className="text-sm text-muted-foreground">aditi.sharma@logpulse.io · Admin</p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Password</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input defaultValue="Aditi Sharma" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input defaultValue="aditi.sharma@logpulse.io" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Input defaultValue="Admin" disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Theme</Label>
                <Select value={theme} onValueChange={(v) => setTheme(v as 'dark' | 'light')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button>Save changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-5 sm:max-w-sm">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input type="password" />
              </div>
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input type="password" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm new password</Label>
                <Input type="password" />
              </div>
              <Button className="w-full">Update password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Used to authenticate requests made on your behalf.</CardDescription>
              </div>
              <Button size="sm"><Plus className="h-4 w-4" /> New key</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {API_KEYS.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{k.prefix}</TableCell>
                      <TableCell className="text-muted-foreground">{k.created}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {SESSIONS.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{s.device}</p>
                    <p className="text-xs text-muted-foreground">{s.location}</p>
                  </div>
                  {s.current ? <Badge>Current session</Badge> : <Button variant="outline" size="sm">Revoke</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}