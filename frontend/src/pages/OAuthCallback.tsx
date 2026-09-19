import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

// The backend redirects here as http://<frontend>/oauth-callback?token=...
// once a Google/GitHub sign-in succeeds. Provider-side errors are sent to
// /login?error=... instead, so this page only ever has to handle success —
// but we still guard against a missing token defensively.
export default function OAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [error, setError] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const token = params.get('token')
    if (!token) {
      setError('No sign-in token was returned. Please try again.')
      return
    }

    setSession(token)
    navigate('/dashboard', { replace: true })
  }, [params, navigate, setSession])

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-level-error" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => navigate('/login', { replace: true })}>Back to login</Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      </div>
    </div>
  )
}