import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, AuthCard, OrDivider, OAuthButtons } from '@/components/auth/AuthShell'
import { useAuth, ApiError } from '@/lib/auth-context'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // The backend sends failed OAuth attempts back here as ?error=message.
  useEffect(() => {
    const oauthError = searchParams.get('error')
    if (oauthError) {
      setError(oauthError)
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Enter both an email and a password.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-center text-xl font-semibold tracking-tight">Log in to LogPulse</h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Every log, trace, and alert — one signal.
        </p>

        <div className="mt-7">
          <OAuthButtons />
        </div>

        <OrDivider label="or continue with email" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Inverted neutral button: black in light mode, white in dark — the
              Vercel look. tailwind-merge lets these override bg-primary. */}
          <Button
            type="submit"
            disabled={loading}
            className="h-10 w-full bg-foreground text-background shadow-none hover:bg-foreground/90"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing, you agree to LogPulse&apos;s Terms of Service and Privacy Policy.
        </p>
      </AuthCard>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <span className="font-medium text-foreground">Ask your admin to invite you.</span>
      </p>
    </AuthShell>
  )
}
