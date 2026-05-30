import { SuperAdminAnalyticsDashboard } from '@/components/superadmin/analytics-dashboard'

export const dynamic = 'force-dynamic'

export default function SuperAdminAnalyticsPage() {
  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Superadmin
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Analiticas
          </h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Indicadores para revisar crecimiento, ingresos recurrentes, distribucion de planes y actividad de la plataforma.
          </p>
        </div>
      </header>

      <SuperAdminAnalyticsDashboard />
    </div>
  )
}
