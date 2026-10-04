import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { HealthReport } from '@/lib/health/types'

export function ExecutiveHealthSummary({ report }: { report: HealthReport }) {
  const cards = [
    ['Críticos', report.executiveSummary.critical],
    ['Advertencias', report.executiveSummary.warnings],
    ['Nuevos o empeoraron', report.executiveSummary.newOrWorsened],
    ['Resueltos', report.executiveSummary.resolved],
  ] as const

  return (
    <section className="space-y-3" aria-labelledby="executive-health-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="executive-health-title" className="text-base font-semibold">Resumen ejecutivo</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{report.scope.complete ? 'Comprobación completa' : 'Comprobación parcial'}</Badge>
          <Badge variant="outline">
            {report.comparison.previousRunId ? 'Comparado con ejecución anterior' : 'Sin comparación anterior'}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="rounded-xl">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
