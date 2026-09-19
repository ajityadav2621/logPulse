import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  hint,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
  tone?: 'default' | 'critical' | 'error' | 'warning' | 'info' | 'debug' | 'primary'
  hint?: string
}) {
  const toneClass: Record<string, string> = {
    default: 'text-foreground bg-muted',
    primary: 'text-primary bg-primary/10',
    critical: 'text-level-critical bg-level-critical/10',
    error: 'text-level-error bg-level-error/10',
    warning: 'text-level-warning bg-level-warning/10',
    info: 'text-level-info bg-level-info/10',
    debug: 'text-level-debug bg-level-debug/10',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon && <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneClass[tone])}>{icon}</div>}
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular leading-tight">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}