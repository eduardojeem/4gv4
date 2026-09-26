'use client'

import { BriefcaseBusiness, Building2, CircleHelp, Crown, ShieldCheck, UserRound, UserRoundCog, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const roleExamples = [
  {
    role: 'Propietario',
    icon: Crown,
    example: 'María es propietaria: controla la empresa y la facturación.',
    detail: 'Es la responsable principal y no puede editarse ni desactivarse desde esta sección.',
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-300',
  },
  {
    role: 'Administrador',
    icon: ShieldCheck,
    example: 'Pedro es administrador: gestiona el personal y la operación diaria.',
    detail: 'Puede configurar el sistema, administrar usuarios y supervisar todas las sucursales.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300',
  },
  {
    role: 'Vendedor',
    icon: BriefcaseBusiness,
    example: 'Laura trabaja como vendedora en la sucursal Centro.',
    detail: 'Puede vender, usar caja y atender clientes dentro de las sucursales asignadas.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300',
  },
  {
    role: 'Técnico',
    icon: Wrench,
    example: 'Carlos es técnico: recibe y actualiza reparaciones.',
    detail: 'Accede al trabajo técnico y a los datos operativos necesarios para completarlo.',
    tone: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300',
  },
  {
    role: 'Cliente',
    icon: UserRound,
    example: 'Ana es cliente: compra en la tienda pública y consulta su información.',
    detail: 'No forma parte del personal y no ocupa un cupo de staff del plan.',
    tone: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  },
]

export function UsersHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
          <CircleHelp className="h-3.5 w-3.5" />
          Cómo funciona
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cómo funciona la gestión de usuarios</DialogTitle>
          <DialogDescription>
            Elegí el rol según el trabajo de cada persona y limitá su acceso con sucursales y estados.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3" aria-labelledby="role-examples-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="role-examples-heading" className="text-sm font-semibold">Ejemplos por rol</h3>
            <Badge variant="secondary">El menor acceso necesario</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {roleExamples.map(({ role, icon: Icon, example, detail, tone }) => (
              <article key={role} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold">{role}</h4>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{example}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 border-t pt-4 sm:grid-cols-2" aria-label="Sucursales y cupos">
          <div className="flex gap-3 rounded-lg bg-muted/50 p-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold">Sucursales</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Si asignás a Laura únicamente a Centro, verá las cajas, ventas y datos habilitados para esa sucursal.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg bg-muted/50 p-3">
            <UserRoundCog className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold">Cupos del plan</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Cada integrante activo ocupa un cupo. Suspender a un integrante libera su cupo sin borrar su historial.
              </p>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
