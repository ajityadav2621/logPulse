import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'outline'; label?: string }> = {
  running: { variant: 'default' },
  online: { variant: 'default' },
  active: { variant: 'default' },
  resolved: { variant: 'default' },
  enabled: { variant: 'default' },
  degraded: { variant: 'warning' },
  maintenance: { variant: 'warning' },
  pending: { variant: 'warning' },
  acknowledged: { variant: 'warning' },
  investigating: { variant: 'warning' },
  monitoring: { variant: 'warning' },
  invited: { variant: 'secondary' },
  stopped: { variant: 'destructive' },
  offline: { variant: 'destructive' },
  deactivated: { variant: 'destructive' },
  disabled: { variant: 'outline' },
  open: { variant: 'destructive' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = MAP[status] ?? { variant: 'outline' as const }
  return (
    <Badge variant={cfg.variant} className={cn('capitalize', className)}>
      {cfg.label ?? status}
    </Badge>
  )
}