import { MousePointerClick } from 'lucide-react'
import { SiteAnalyticsDashboard } from '@/components/site-analytics/SiteAnalyticsDashboard'
import { PlanGate } from '@/components/admin/PlanGate'

export default function WebsiteVisitsPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-start gap-4 p-5 lg:p-6">
          <div className="rounded-md border bg-background p-3 text-blue-600 dark:text-blue-400">
            <MousePointerClick className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Visitas web</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Cuántas personas visitan tu tienda online, qué páginas y productos miran, desde dónde llegan y
              cuántas terminan escribiéndote por WhatsApp o haciendo un pedido.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No se cuentan las visitas de tu equipo mientras tengan la sesión iniciada.
            </p>
          </div>
        </div>
      </section>

      <PlanGate
        module="analytics"
        requiredPlan="Pro"
        title="Visitas web"
        description="Las visitas de tu tienda online están disponibles desde el plan Pro. Subí tu plan para ver de dónde llegan tus clientes y qué miran."
      >
        <SiteAnalyticsDashboard endpoint="/api/admin/analytics/website" variant="organization" />
      </PlanGate>
    </div>
  )
}
