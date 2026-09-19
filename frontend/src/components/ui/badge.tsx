import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        critical: 'border-transparent bg-level-critical/15 text-level-critical',
        error: 'border-transparent bg-level-error/15 text-level-error',
        warning: 'border-transparent bg-level-warning/15 text-level-warning',
        info: 'border-transparent bg-level-info/15 text-level-info',
        debug: 'border-transparent bg-level-debug/15 text-level-debug',
        success: 'border-transparent bg-primary/15 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }