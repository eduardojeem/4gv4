import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpRight, CreditCard, ShoppingCart, TrendingUp, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { PosStats } from '../hooks/usePosStats'

type Tone = 'emerald' | 'indigo' | 'violet' | 'amber'

const toneClasses: Record<Tone, { wrap: string; iconBg: string }> = {
  emerald: { wrap: 'from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  indigo:  { wrap: 'from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50',     iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  violet:  { wrap: 'from-violet-500/10 to-transparent border-violet-200/50 dark:border-violet-900/50',    iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  amber:   { wrap: 'from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50',       iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
}

function MetricCard({
  label, value, sub, icon: Icon, tone,
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
}) {
  const t = toneClasses[tone]
  return (
    <Card className={cn('overflow-hidden border bg-gradient-to-br shadow-sm transition-shadow hover:shadow-md', t.wrap)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate" title={sub}>{sub}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface PosStatsGridProps {
  stats: PosStats
}

export function PosStatsGrid({ stats }: PosStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Ventas totales"
        value={formatCurrency(stats.totalSales)}
        sub="en el período seleccionado"
        icon={DollarSign}
        tone="emerald"
      />
      <MetricCard
        label="Transacciones"
        value={stats.totalTransactions.toString()}
        sub="tickets generados"
        icon={ShoppingCart}
        tone="indigo"
      />
      <MetricCard
        label="Ticket promedio"
        value={formatCurrency(stats.averageTicket)}
        sub="valor promedio por venta"
        icon={CreditCard}
        tone="violet"
      />
      <MetricCard
        label="Producto top"
        value={`${stats.topProduct.sales} ${stats.topProduct.sales === 1 ? 'unidad' : 'unidades'}`}
        sub={stats.topProduct.name || 'Sin datos'}
        icon={TrendingUp}
        tone="amber"
      />
    </div>
  )
}
