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
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-red-600 dark:text-red-400 shrink-0">
              <Shield className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Centro de Seguridad & Auditoría
                </h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-bold gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Blindado
                </Badge>
              </div>
              <p className="max-w-3xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Supervisa en tiempo real los inicios de sesión, cambios críticos de inventario y privilegios de usuarios. Diagnostica la postura de seguridad y el aislamiento de sucursales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground font-semibold shrink-0">
            <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span>Monitoreo Activo 24/7</span>
          </div>
        </div>
      </section>

      {/* ── Guía Desplegable de Funcionamiento ── */}
      <Card className="bg-gradient-to-br from-primary/5 via-primary/3 to-muted/20 border border-primary/20 backdrop-blur-md rounded-2xl shadow-xs">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5">
            <div className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>¿Cómo funciona el Centro de Seguridad?</span>
            </div>
            <div className="text-xs font-semibold text-primary select-none">
              <span className="group-open:hidden flex items-center gap-1">Mostrar guía explicativa ↓</span>
              <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
            </div>
          </summary>
          <CardContent className="pt-0 pb-5 text-xs">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="space-y-1.5 p-4 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <h4 className="font-bold text-foreground flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-primary/10 text-primary font-bold">1</Badge>
                  <span>Bitácora de Auditoría</span>
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Registra de forma indeleble todas las acciones administrativas, exportaciones de clientes, ajustes de inventario y sesiones abiertas con IP y User Agent.
                </p>
              </div>

              <div className="space-y-1.5 p-4 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <h4 className="font-bold text-foreground flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-primary/10 text-primary font-bold">2</Badge>
                  <span>Diagnóstico de Salud</span>
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Verifica que las políticas de Row Level Security (RLS), el cifrado TLS en tránsito y la sanitización anti-inyecciones se mantengan al 100% de efectividad.
                </p>
              </div>

              <div className="space-y-1.5 p-4 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <h4 className="font-bold text-foreground flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-primary/10 text-primary font-bold">3</Badge>
                  <span>Control de Accesos</span>
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Permite auditar el personal con cuentas activas, inspeccionar su historial individual de actividad y suspender credenciales comprometidas de inmediato.
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
