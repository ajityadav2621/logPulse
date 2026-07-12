import { Badge } from '@/components/ui/badge'
import type { LogLevel } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const VARIANT: Record<LogLevel, 'critical' | 'error' | 'warning' | 'info' | 'debug'> = {
  critical: 'critical',
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'debug',
}

export function LevelBadge({ level, className }: { level: LogLevel; className?: string }) {
  return (
    <Badge variant={VARIANT[level]} className={cn('uppercase tracking-wide', className)}>
      {level}
    </Badge>
  )
}