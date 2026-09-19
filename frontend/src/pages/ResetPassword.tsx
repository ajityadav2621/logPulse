import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, AuthCard } from '@/components/auth/AuthShell'
import { useAuth, ApiError } from '@/lib/auth-context'
import { resetPassword } from '@/lib/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { setSession } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    try {
      // The backend returns a fresh session on success — use it to land
      // straight in the app, like accept-invite does.
      const res = await resetPassword(token, password)
      setSession(res.token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-center text-xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Your new password must be at least 8 characters.
        </p>

        {!token && (
          <div className="mt-6 flex items-start gap-2 rounded-md border border-level-warning/30 bg-level-warning/10 px-3 py-2 text-sm text-level-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This link is missing its reset token. Request a fresh link from the log in page.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-10 pr-9"
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
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="h-10"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !token}
            className="h-10 w-full bg-foreground text-background shadow-none hover:bg-foreground/90"
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      </AuthCard>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  )
}
