import { Suspense } from 'react'
import { Activity, Loader2, Shield, Info, ShieldCheck, Lock, Users } from 'lucide-react'
import { SecurityPanel } from '@/components/admin/system/security-panel'
import { PlanGate } from '@/components/admin/PlanGate'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SecurityPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Encabezado Principal ── */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Centro de Seguridad & Control de Actividad
                </h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-bold gap-1.5 py-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sistema Protegido
                </Badge>
              </div>
              <p className="max-w-3xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Supervisa quién ingresa al sistema, qué cambios se realizan en tu tienda y mantén la información de tu negocio bajo control en todo momento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground font-semibold shrink-0">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span>Monitoreo Automático Activo 24/7</span>
          </div>
        </div>
      </section>

      {/* ── Guía Desplegable de Funcionamiento para Usuarios Normales ── */}
      <Card className="bg-gradient-to-br from-primary/5 via-background to-muted/20 border border-primary/20 backdrop-blur-md rounded-2xl shadow-xs">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5">
            <div className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>¿Para qué sirve este panel de seguridad?</span>
            </div>
            <div className="text-xs font-semibold text-primary select-none">
              <span className="group-open:hidden flex items-center gap-1">Ver explicación rápida ↓</span>
              <span className="hidden group-open:flex items-center gap-1">Ocultar explicación ↑</span>
            </div>
          </summary>
          <CardContent className="pt-0 pb-5 text-xs">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="space-y-1.5 p-4 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <h4 className="font-bold text-foreground flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-primary/10 text-primary font-bold">1</Badge>
                  <span>¿Quién hizo qué?</span>
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Conoce qué empleado inició sesión, quién modificó un precio, quién eliminó un dato o quién descargó un listado de clientes en Excel.
                </p>
              </div>

              <div className="space-y-1.5 p-4 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <h4 className="font-bold text-foreground flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 font-bold">2</Badge>
                  <span>¿Mi tienda está a salvo?</span>
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Tu sistema cuenta con escudos automáticos de protección: aislamiento estricto de sucursales, contraseñas protegidas y bloqueo automático ante contraseñas incorrectas.
                </p>
              </div>

              <div className="space-y-1.5 p-4 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <h4 className="font-bold text-foreground flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-purple-500/10 text-purple-600 font-bold">3</Badge>
                  <span>¿Quién puede entrar?</span>
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Revisa la lista de empleados y clientes registrados. Si un empleado deja tu negocio o pierde su teléfono, puedes suspender su acceso con un solo clic.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      {/* ── Panel Principal ── */}
      <PlanGate
        module="security"
        title="Seguridad avanzada no está incluida en tu plan"
        description="Actualiza tu plan para monitorear accesos, eventos sensibles y acciones administrativas."
      >
        <Suspense fallback={
          <div className="rounded-2xl border border-border/80 bg-card p-12">
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Cargando centro de seguridad y auditoría...</span>
            </div>
          </div>
        }>
          <SecurityPanel />
        </Suspense>
      </PlanGate>
    </div>
  )
}
