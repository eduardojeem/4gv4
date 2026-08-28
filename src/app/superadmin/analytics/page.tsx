import { BarChart3 } from 'lucide-react'
import { SuperAdminAnalyticsDashboard } from '@/components/superadmin/analytics-dashboard'

export const dynamic = 'force-dynamic'

export default function SuperAdminAnalyticsPage() {
  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" />
          Analytics SaaS
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Analíticas de la plataforma
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Seguí el crecimiento, los ingresos recurrentes y la actividad de las empresas en un mismo período.
        </p>
      </header>

      <SuperAdminAnalyticsDashboard />
    </div>
  )
}
