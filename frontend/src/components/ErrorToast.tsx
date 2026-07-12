import { useEffect, useState } from 'react'
import type { LogEntry } from '../api/logs'

export default function ErrorToast({ log }: { log: LogEntry | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!log) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [log])

  if (!log || !visible) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm rounded border border-red-800 bg-red-950/90 px-4 py-3 shadow-lg">
      <div className="flex items-start gap-2">
        <span className="text-red-400 font-semibold text-sm">New error</span>
        <button onClick={() => setVisible(false)} className="ml-auto text-red-400 hover:text-red-200 text-xs">
          ✕
        </button>
      </div>
      <div className="text-sm text-slate-200 mt-1">
        <span className="text-slate-400">{log.app_name}:</span> {log.message}
      </div>
    </div>
  )
}
