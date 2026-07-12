import { useNavigate } from 'react-router-dom'

export default function Navbar({ connected }: { connected: boolean }) {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-lg font-semibold">LogPulse</h1>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-2 py-1 rounded ${
            connected ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'
          }`}
        >
          ● {connected ? 'connected' : 'disconnected'}
        </span>
        <button
          onClick={logout}
          className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
