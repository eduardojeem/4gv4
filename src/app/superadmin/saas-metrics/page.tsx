import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { getSaasMetrics } from '@/lib/superadmin/saas-metrics'
import { SaasMetricsDashboard } from '@/components/superadmin/SaasMetricsDashboard'

async function MetricsContent() {
  const data = await getSaasMetrics()
  return <SaasMetricsDashboard data={data} />
}

export default function SuperAdminSaaSMetricsPage() {
  return (
    <div className="mx-auto max-w-[1480px] space-y-2">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Métricas SaaS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Uso real por organización — límites de plan, recursos consumidos y alertas de capacidad.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando métricas de todos los tenants...</span>
          </div>
        </div>
      }>
        <MetricsContent />
      </Suspense>
    </div>
  )
}
