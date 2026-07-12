import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

export function GaugeChart({ label, value, className }: { label: string; value: number; className?: string }) {
  const color = value >= 85 ? 'hsl(var(--level-error))' : value >= 65 ? 'hsl(var(--level-warning))' : 'hsl(var(--primary))'
  const data = [{ name: label, value, fill: color }]
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={9}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={9} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular">{value}%</span>
        </div>
      </div>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}