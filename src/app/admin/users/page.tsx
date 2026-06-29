import { Suspense } from 'react'
import { UserManagement } from '@/components/admin/users/user-management'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import { PlanLimitBanner } from '@/components/subscription/PlanLimitBanner'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PlanLimitBanner resource="users" />
      {/* Guía de funcionamiento de usuarios */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
            <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la Gestión de Usuarios?
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
                  Roles y Permisos
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Asigna roles como Administrador, Técnico, Cajero o Soporte. Cada rol otorga accesos específicos del sistema, protegiendo módulos sensibles de configuraciones y cobros.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                  Asociación de Sucursales
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Vincula a tus empleados con una o varias sucursales activas. Esto limita automáticamente los datos (cajas, stock, reparaciones) a los que el empleado tiene acceso.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                  Control de Cupos (Plan)
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Tu plan actual define el número máximo de staff activo. Puedes suspender personal antiguo para liberar cupos sin perder su historial administrativo y de ventas.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      <Suspense fallback={<div className="p-4">Cargando gestión de usuarios...</div>}>
        <UserManagement />
      </Suspense>
    </div>
  )
}
