import { Suspense } from 'react'
import { Activity, Loader2, Shield, Info } from 'lucide-react'
import { SecurityPanel } from '@/components/admin/system/security-panel'
import { PlanGate } from '@/components/admin/PlanGate'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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

      {/* Guía de funcionamiento de seguridad */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
            <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la Sección de Seguridad?
            </div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
              <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
              <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
            </div>
          </summary>
          <CardContent className="pt-0 pb-5 text-xs">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                  Bitácora de Eventos
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Registra todas las acciones administrativas críticas y los inicios de sesión dentro de la organización. Permite auditar qué usuario realizó qué cambio y cuándo.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                  Detección de Anomalías
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Analiza patrones inusuales de acceso o cambios bruscos de rol. Te ayuda a mantener blindado el sistema frente a posibles filtraciones de credenciales.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                  Cumplimiento y RLS
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Valida que los accesos por sucursal (Row Level Security) se respeten en todas las consultas y que el personal acceda únicamente a los datos autorizados de su área.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      <PlanGate
        module="security"
        title="Seguridad avanzada no está incluida en tu plan"
        description="Actualiza tu plan para monitorear accesos, eventos sensibles y acciones administrativas."
      >
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
      </PlanGate>
    </div>
  )
}
