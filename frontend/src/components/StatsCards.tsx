import type { LogEntry } from '../api/logs'

export default function StatsCards({ logs }: { logs: LogEntry[] }) {
  const total = logs.length
  const errors = logs.filter((l) => l.level === 'error').length
  const warnings = logs.filter((l) => l.level === 'warn').length
  const info = logs.filter((l) => l.level === 'info').length

  const cards = [
    { label: 'Total Logs', value: total, color: 'text-slate-100' },
    { label: 'Errors', value: errors, color: 'text-red-400' },
    { label: 'Warnings', value: warnings, color: 'text-amber-400' },
    { label: 'Info', value: info, color: 'text-sky-400' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="text-xs text-slate-500 mb-1">{c.label}</div>
          <div className={`text-2xl font-semibold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}
