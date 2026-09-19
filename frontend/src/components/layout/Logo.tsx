import { cn } from '@/lib/utils'

export function Logo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" className="shrink-0">
        <rect width="26" height="26" rx="7" className="fill-primary/15" />
        <path
          d="M4 14h3.2l1.6-5.5 3 11 2.4-8.5 1.4 3h6.4"
          stroke="hsl(var(--primary))"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {!markOnly && <span className="text-[15px] font-bold tracking-tight">LogPulse</span>}
    </div>
  )
}