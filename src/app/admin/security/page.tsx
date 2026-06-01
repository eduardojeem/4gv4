import { Suspense } from 'react'
import { Activity, Loader2, Shield } from 'lucide-react'
import { SecurityPanel } from '@/components/admin/system/security-panel'

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-md border bg-background p-3 text-red-600 dark:text-red-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Seguridad</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Monitorea accesos, cambios sensibles y acciones administrativas de tu organización.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            Auditoría en tiempo real
          </div>
        </div>
      </section>
      <Suspense fallback={
        <div className="rounded-lg border bg-card p-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando panel de seguridad...
          </div>
        </div>
      }>
        <SecurityPanel />
      </Suspense>
    </div>
  )
}
