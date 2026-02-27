import { Suspense } from 'react'
import { SecurityPanel } from '@/components/admin/system/security-panel'
import { Shield, Loader2 } from 'lucide-react'

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Seguridad</h1>
            <p className="text-sm text-muted-foreground">Auditoría, alertas y trazabilidad de accesos.</p>
          </div>
        </div>
      </div>
      <Suspense fallback={
        <div className="rounded-xl border bg-card p-8">
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
