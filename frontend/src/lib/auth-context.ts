import * as React from 'react'
import { ApiError, type BackendUser, clearToken, fetchMe, getToken, login as apiLogin, setToken } from '@/lib/api'

interface AuthContextValue {
  user: BackendUser | null
  /** true while we're checking an existing token on first load */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  /** Used by the OAuth callback page, which already has a token in hand. */
  setSession: (token: string, user?: BackendUser) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<BackendUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadUser = React.useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch (err) {
      // Token expired or invalid — drop it and send them back to login.
      clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = React.useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const setSession = React.useCallback((token: string, providedUser?: BackendUser) => {
    setToken(token)
    if (providedUser) {
      setUser(providedUser)
    } else {
      // OAuth callback only has the token — fetch the profile it belongs to.
      fetchMe().then(setUser).catch(() => clearToken())
    }
  }, [])

  const logout = React.useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value: AuthContextValue = { user, loading, login, setSession, logout, refreshUser: loadUser }

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ApiError }