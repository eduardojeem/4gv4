import { MousePointerClick } from 'lucide-react'
import { SiteAnalyticsDashboard } from '@/components/site-analytics/SiteAnalyticsDashboard'

export const dynamic = 'force-dynamic'

export default function SuperAdminWebsiteVisitsPage() {
  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <MousePointerClick className="h-3.5 w-3.5" />
          Tráfico web
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Visitas de la plataforma
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Visitas e interacciones del marketplace y de las tiendas de todas las organizaciones.
        </p>
      </header>

      <SiteAnalyticsDashboard endpoint="/api/superadmin/analytics/website" variant="platform" />
    </div>
  )
}
