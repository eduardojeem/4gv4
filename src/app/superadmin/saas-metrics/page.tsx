import { Suspense } from 'react'
import { Gauge, Loader2 } from 'lucide-react'
import { getSaasMetrics } from '@/lib/superadmin/saas-metrics'
import { SaasMetricsDashboard } from '@/components/superadmin/SaasMetricsDashboard'

export const dynamic = 'force-dynamic'

async function MetricsContent() {
  const data = await getSaasMetrics()
  return <SaasMetricsDashboard data={data} />
}

export default function SuperAdminSaaSMetricsPage() {
  return (
    <div className="mx-auto max-w-[1480px] space-y-2">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <Gauge className="h-3.5 w-3.5" />
          Capacidad de los planes
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Métricas SaaS
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Empezá por las empresas que necesitan intervención y revisá después las que se acercan a sus límites.
        </p>
      </header>

      <Suspense fallback={
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando métricas de las empresas...</span>
          </div>
        </div>
      }>
        <MetricsContent />
      </Suspense>
    </div>
  )
}
