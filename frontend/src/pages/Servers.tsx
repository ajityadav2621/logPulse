import { useState } from 'react'
import { Search, Cpu, MemoryStick, HardDrive } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SERVERS_LIST } from '@/lib/mock-data'
import { formatNumber } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

function usageColor(v: number) {
  if (v >= 85) return 'bg-level-error'
  if (v >= 65) return 'bg-level-warning'
  return 'bg-primary'
}

export default function Servers() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const rows = SERVERS_LIST.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <PageHeader title="Servers" description="Infrastructure health across every registered host." />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search servers..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
          <Card key={s.id} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => navigate('/logs')}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">{s.name}</CardTitle>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{s.ip}</p>
              </div>
              <StatusBadge status={s.status} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{s.location}</span>
                <span>{s.os}</span>
              </div>

              <UsageBar icon={<Cpu className="h-3.5 w-3.5" />} label="CPU" value={s.cpu} />
              <UsageBar icon={<MemoryStick className="h-3.5 w-3.5" />} label="RAM" value={s.ram} />
              <UsageBar icon={<HardDrive className="h-3.5 w-3.5" />} label="Disk" value={s.disk} />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {s.services.map((svc) => (
                  <Badge key={svc} variant="secondary">{svc}</Badge>
                ))}
              </div>

              <p className="pt-1 text-xs text-muted-foreground">{formatNumber(s.logCount)} logs / 24h</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function UsageBar({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">{icon} {label}</span>
        <span className="font-mono tabular">{value}%</span>
      </div>
      <Progress value={value} indicatorClassName={usageColor(value)} />
    </div>
  )
}