import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { HealthMetricGroup, HealthReport } from '@/lib/health/types'
import { StatusBadge } from './CheckDetailSheet'

function Metrics({ group }: { group: HealthMetricGroup | null | undefined }) {
  if (!group) return <p className="text-sm text-slate-500">No verificable: la fuente no devolvió métricas.</p>
  return (
    <dl className="grid grid-cols-2 gap-3">
      {group.metrics.map((metric) => (
        <div key={metric.label}>
          <dt className="text-xs text-slate-500">{metric.label}</dt>
          <dd className="text-sm font-semibold">
            {metric.value === null ? 'No verificable' : metric.value}
            {metric.value === null && metric.unavailableReason && (
              <span className="block text-xs font-normal text-slate-500">{metric.unavailableReason}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function OperationalHealthPanels({ report }: { report: HealthReport }) {
  const performance = report.metrics.find((group) => group.id === 'performance')
  const images = report.metrics.find((group) => group.id === 'images')
  return (
    <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" aria-label="Paneles operativos">
      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Despliegue</CardTitle></CardHeader>
        <CardContent><Metrics group={report.deployment} /></CardContent>
      </Card>
      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Servicios externos</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {report.serviceHealth.map((service) => (
              <li key={service.id} className="flex items-start justify-between gap-3">
                <span><span className="block text-sm font-semibold">{service.name}</span><span className="block text-xs text-slate-500">{service.summary}</span>
                  <span className="block text-[11px] text-slate-400">Fuente: {service.source} · Comprobado: {service.checkedAt ?? 'No verificable'} · Latencia: {service.latencyMs === null ? 'No verificable' : `${service.latencyMs} ms`}</span>
                  {service.unavailableReason && <span className="block text-[11px] text-amber-700">{service.unavailableReason}</span>}
                </span>
                <StatusBadge status={service.status} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Tareas programadas</CardTitle>
          <CardDescription>Las fechas ausentes no se estiman.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {report.scheduledTasks.map((task) => (
              <li key={task.id} className="space-y-1">
                <div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold">{task.name}</span><StatusBadge status={task.status} /></div>
                <p className="text-xs text-slate-500">
                  {task.summary} · Última ejecución:{' '}
                  {task.lastRunAt ?? <strong className="font-semibold">No verificable</strong>}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Rendimiento</CardTitle></CardHeader><CardContent><Metrics group={performance} /></CardContent></Card>
      <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Imágenes</CardTitle></CardHeader><CardContent><Metrics group={images} /></CardContent></Card>
    </section>
  )
}
