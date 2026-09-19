import { cn } from '@/lib/utils'

const COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-primary',
  yellow: 'bg-level-warning',
  red: 'bg-level-error',
}

export function HealthDot({ status, pulse = false, className }: { status: 'green' | 'yellow' | 'red'; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5', className)}>
      {pulse && <span className={cn('absolute inline-flex h-full w-full animate-pulse-ring rounded-full', COLOR[status])} />}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', COLOR[status])} />
    </span>
  )
}