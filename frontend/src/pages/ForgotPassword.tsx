import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, AuthCard } from '@/components/auth/AuthShell'
import { forgotPassword } from '@/lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter the email you use for LogPulse.')
      return
    }
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      // The backend always responds the same way regardless of whether the
      // account exists — mirror that neutrality here.
      setSent(true)
    } catch {
      setError('Could not send the request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border">
              <MailCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              we&apos;ve sent a link to reset your password. It expires in 30 minutes.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-6 h-10 w-full shadow-none"
            >
              <Link to="/login">Back to log in</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-1.5 text-center text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-10 w-full bg-foreground text-background shadow-none hover:bg-foreground/90"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
      </AuthCard>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  )
}
