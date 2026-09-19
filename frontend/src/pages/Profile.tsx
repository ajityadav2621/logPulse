import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-context'
import { changePassword, setToken, updateAccount, ApiError } from '@/lib/api'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export default function Profile() {
  const { user, refreshUser } = useAuth()

  return (
    <div>
      <PageHeader title="Account" description="Your profile, sign-in details, and password." />

      <div className="mb-4 flex items-center gap-4">
        <Avatar className="h-14 w-14">
          {user?.avatar_url ? <img src={user.avatar_url} alt={user.name} /> : undefined}
          <AvatarFallback className="text-lg">{initials(user?.name ?? '?')}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-lg font-semibold leading-tight">{user?.name}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {user?.email}
            <Badge variant="outline" className="capitalize">
              {user?.role}
            </Badge>
          </p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Profile</TabsTrigger>
          <TabsTrigger value="security">Password</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <ProfileForm
            initialName={user?.name ?? ''}
            initialEmail={user?.email ?? ''}
            hasPassword={(user?.provider ?? 'local') === 'local'}
            onSaved={refreshUser}
          />
        </TabsContent>

        <TabsContent value="security">
          <PasswordForm provider={user?.provider ?? 'local'} onSaved={refreshUser} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileForm({
  initialName,
  initialEmail,
  hasPassword,
  onSaved,
}: {
  initialName: string
  initialEmail: string
  hasPassword: boolean
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const emailChanged = email.trim().toLowerCase() !== initialEmail.toLowerCase()
  const nameChanged = name.trim() !== initialName

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!nameChanged && !emailChanged) return
    if (emailChanged && !currentPassword) {
      setError('Re-enter your current password to change your email.')
      return
    }

    setLoading(true)
    try {
      const res = await updateAccount({
        ...(nameChanged ? { name: name.trim() } : {}),
        ...(emailChanged ? { email: email.trim().toLowerCase(), current_password: currentPassword } : {}),
      })
      // Changing the email invalidates old JWTs — the backend hands back a
      // fresh one so this session survives.
      if (res.token) setToken(res.token)
      await onSaved()
      setCurrentPassword('')
      setSuccess(emailChanged ? 'Profile and email updated.' : 'Profile updated.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your name and the email you sign in with. Changing your email requires your current
          password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid max-w-lg grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {emailChanged && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-email-password">Current password</Label>
              <Input
                id="confirm-email-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required to change your email"
                autoComplete="current-password"
              />
              {!hasPassword && (
                <p className="text-xs text-muted-foreground">
                  Your account signs in with Google/GitHub and has no password set, so email
                  changes need a local password first.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </p>
          )}

          <div>
            <Button type="submit" disabled={loading || (!nameChanged && !emailChanged)}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordForm({
  provider,
  onSaved,
}: {
  provider: string
  onSaved: () => Promise<void>
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    try {
      const res = await changePassword(currentPassword, newPassword)
      // Other sessions are invalidated; the fresh token keeps this one alive.
      setToken(res.token)
      await onSaved()
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setSuccess('Password updated.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (provider !== 'local') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            You sign in with {provider === 'google' ? 'Google' : 'GitHub'}, so you manage your
            password there. Ask an admin about setting a local password if you need one.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Updating your password signs out your other sessions. This is also the fix for a
          forgotten password — or use the &quot;Forgot password?&quot; link on the login screen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid max-w-sm grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </p>
          )}

          <div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
