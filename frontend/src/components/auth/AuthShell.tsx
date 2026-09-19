import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { useTheme } from '@/lib/theme-provider'
import { googleLoginUrl, githubLoginUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

// Shared shell for the unauthenticated pages (login, forgot/reset password):
// plain background, centered column, minimal logo above the card, thin 1px
// card borders — the Vercel auth look. No heavy shadows, generous whitespace.
export function AuthShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <Logo className="mb-8" />
      {children}
    </div>
  )
}

export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full max-w-[400px] rounded-xl border border-border bg-card p-8', className)}>
      {children}
    </div>
  )
}

// "or continue with email" hairline divider.
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

// OAuth is the visually primary path: full-width, stacked, icon + label.
// Full page navigation on purpose — this must leave the SPA so the backend
// can redirect to Google/GitHub and back.
export function OAuthButtons() {
  return (
    <div className="space-y-3">
      <a
        href={googleLoginUrl()}
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-card text-sm font-medium transition-colors hover:bg-accent"
      >
        <GoogleIcon className="h-4 w-4" /> Continue with Google
      </a>
      <a
        href={githubLoginUrl()}
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-card text-sm font-medium transition-colors hover:bg-accent"
      >
        <GithubIcon className="h-4 w-4" /> Continue with GitHub
      </a>
    </div>
  )
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn(className)}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.42.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}
