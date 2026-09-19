import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from '@/lib/theme-provider'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import AppLayout from '@/components/layout/AppLayout'

import Login from '@/pages/Login'
import OAuthCallback from '@/pages/OAuthCallback'
import AcceptInvite from '@/pages/AcceptInvite'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import LogExplorer from '@/pages/LogExplorer'
import LogDetails from '@/pages/LogDetails'
import LiveLogs from '@/pages/LiveLogs'
import Applications from '@/pages/Applications'
import Servers from '@/pages/Servers'
import Alerts from '@/pages/Alerts'
import Analytics from '@/pages/Analytics'
import SavedSearches from '@/pages/SavedSearches'
import Incidents from '@/pages/Incidents'
import Reports from '@/pages/Reports'
import Notifications from '@/pages/Notifications'
import UserManagement from '@/pages/UserManagement'
import Profile from '@/pages/Profile'
import SettingsPage from '@/pages/Settings'

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  return user ? children : <Navigate to="/login" replace />
}

function RedirectIfAuthed({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  return user ? <Navigate to="/dashboard" replace /> : children
}

function Routing() {
  const { loading, user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route path="/oauth-callback" element={<OAuthCallback />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuthed>
            <ForgotPassword />
          </RedirectIfAuthed>
        }
      />
      {/* No auth redirect here on purpose — someone following a reset email
          link must reach this page even if a stale session exists. */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logs" element={<LogExplorer />} />
        <Route path="/logs/:id" element={<LogDetails />} />
        <Route path="/live-logs" element={<LiveLogs />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/saved-searches" element={<SavedSearches />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="*"
        element={loading ? <FullScreenLoader /> : <Navigate to={user ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routing />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// import { ThemeProvider } from '@/lib/theme-provider'
// import AppLayout from '@/components/layout/AppLayout'

// import Login from '@/pages/Login'
// import Dashboard from '@/pages/Dashboard'
// import LogExplorer from '@/pages/LogExplorer'
// import LogDetails from '@/pages/LogDetails'
// import LiveLogs from '@/pages/LiveLogs'
// import Applications from '@/pages/Applications'
// import Servers from '@/pages/Servers'
// import Alerts from '@/pages/Alerts'
// import Analytics from '@/pages/Analytics'
// import SavedSearches from '@/pages/SavedSearches'
// import Incidents from '@/pages/Incidents'
// import Reports from '@/pages/Reports'
// import Notifications from '@/pages/Notifications'
// import UserManagement from '@/pages/UserManagement'
// import Profile from '@/pages/Profile'
// import SettingsPage from '@/pages/Settings'

// function isAuthed() {
//   return !!localStorage.getItem('token')
// }

// function RequireAuth({ children }: { children: JSX.Element }) {
//   return isAuthed() ? children : <Navigate to="/login" replace />
// }

// export default function App() {
//   return (
//     <ThemeProvider>
//       <BrowserRouter>
//         <Routes>
//           <Route path="/login" element={<Login />} />

//           <Route
//             element={
//               <RequireAuth>
//                 <AppLayout />
//               </RequireAuth>
//             }
//           >
//             <Route path="/dashboard" element={<Dashboard />} />
//             <Route path="/logs" element={<LogExplorer />} />
//             <Route path="/logs/:id" element={<LogDetails />} />
//             <Route path="/live-logs" element={<LiveLogs />} />
//             <Route path="/applications" element={<Applications />} />
//             <Route path="/servers" element={<Servers />} />
//             <Route path="/alerts" element={<Alerts />} />
//             <Route path="/analytics" element={<Analytics />} />
//             <Route path="/saved-searches" element={<SavedSearches />} />
//             <Route path="/incidents" element={<Incidents />} />
//             <Route path="/reports" element={<Reports />} />
//             <Route path="/notifications" element={<Notifications />} />
//             <Route path="/users" element={<UserManagement />} />
//             <Route path="/profile" element={<Profile />} />
//             <Route path="/settings" element={<SettingsPage />} />
//           </Route>

//           <Route path="*" element={<Navigate to={isAuthed() ? '/dashboard' : '/login'} replace />} />
//         </Routes>
//       </BrowserRouter>
//     </ThemeProvider>
//   )
// }