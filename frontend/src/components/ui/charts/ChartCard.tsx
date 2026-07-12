import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ChartCard({
  title,
  action,
  children,
  className,
  height = 240,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  height?: number
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex-1 pt-1" style={{ height }}>
        {children}
      </CardContent>
    </Card>
  )
}