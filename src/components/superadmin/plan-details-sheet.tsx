import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SubscriptionPlan } from '@/services/subscription-plans'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle } from 'lucide-react'

type PlanDetailsSheetProps = {
  plan: SubscriptionPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanDetailsSheet({ plan, open, onOpenChange }: PlanDetailsSheetProps) {
  if (!plan) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              Plan {plan.name}
              {plan.is_popular && <Badge variant="secondary" className="bg-violet-100 text-violet-700">Popular</Badge>}
            </SheetTitle>
            <Badge variant={plan.is_active ? 'default' : 'secondary'}>
              {plan.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <SheetDescription>
            Detalles técnicos y configuración actual del plan en la base de datos.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Información Comercial
            </h3>
            <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900/50">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">ID (Base de datos)</dt>
                  <dd className="font-mono text-xs">{plan.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tier interno</dt>
                  <dd className="font-medium">{plan.tier}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Precio</dt>
                  <dd className="font-medium">${plan.price} {plan.price_note}</dd>
                </div>
                <div className="pt-2">
                  <dt className="text-slate-500 mb-1">Descripción</dt>
                  <dd className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {plan.description}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Límites Configurables
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(plan.limits || {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border bg-white p-3 dark:bg-slate-950">
                  <p className="text-xs text-slate-500 capitalize">{key}</p>
                  <p className="font-medium mt-0.5">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Puntos Destacados
            </h3>
            <ul className="space-y-2">
              {(plan.highlights || []).map((highlight, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Módulos Completos
            </h3>
            <div className="rounded-xl border bg-white divide-y dark:bg-slate-950">
              {(plan.features || []).map((feature: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{feature.label}</span>
                  {typeof feature.value === 'boolean' ? (
                    feature.value ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-300" />
                    )
                  ) : (
                    <span className="font-medium">{feature.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
