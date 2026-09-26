'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CreditCard,
  LayoutGrid,
  List,
  Package,
  Star,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type PlanRow = {
  code: string
  name: string
  priceLabel: string
  priceMonthly: number
  users: string
  branches: string
  cashRegisters: string
  products: string
  marketplace: string
  analytics: string
  credits: string
  isPopular?: boolean
}

type Props = {
  plans: PlanRow[]
  currentPlanCode: string
  canChangePlan: boolean
}

const resources: Array<{ key: keyof PlanRow; label: string; icon: typeof Users }> = [
  { key: 'users', label: 'Usuarios', icon: Users },
  { key: 'branches', label: 'Sucursales', icon: Building2 },
  { key: 'cashRegisters', label: 'Cajas', icon: CreditCard },
  { key: 'products', label: 'Productos', icon: Package },
]

const features: Array<{ key: 'marketplace' | 'analytics' | 'credits'; label: string }> = [
  { key: 'marketplace', label: 'Marketplace web' },
  { key: 'analytics', label: 'Analytics y reportes' },
  { key: 'credits', label: 'Créditos y cuotas' },
]

/**
 * Un tilde o una cruz no dicen nada en voz alta, y la vista de tabla mostraba
 * el mismo dato como texto: la misma informacion en dos idiomas distintos.
 */
function FeatureValue({ value, label }: { value: string; label: string }) {
  if (value === 'Incluido') {
    return (
      <>
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <span className="sr-only">{label}: incluido</span>
      </>
    )
  }
  if (value === 'No incluido') {
    return (
      <>
        <X className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
        <span className="sr-only">{label}: no incluido</span>
      </>
    )
  }
  return <span className="text-xs font-medium text-foreground">{value}</span>
}

/** Adonde te lleva el boton respecto del plan que ya tenes. */
type PlanDirection = 'current' | 'up' | 'down' | 'same-price'

function planDirection(plan: PlanRow, currentPrice: number | null, currentPlanCode: string): PlanDirection {
  if (plan.code === currentPlanCode) return 'current'
  if (currentPrice === null) return 'same-price'
  if (plan.priceMonthly > currentPrice) return 'up'
  if (plan.priceMonthly < currentPrice) return 'down'
  return 'same-price'
}

/** El destino viaja en la URL: antes se elegia el plan dos veces. */
function changePlanHref(code: string) {
  return `/admin/subscriptions/change-plan?plan=${encodeURIComponent(code)}`
}

function PlanCta({
  plan,
  direction,
  canChangePlan,
  className,
  size = 'default',
}: {
  plan: PlanRow
  direction: PlanDirection
  canChangePlan: boolean
  className?: string
  size?: 'default' | 'sm'
}) {
  if (direction === 'current') {
    return (
      <Button variant="outline" size={size} className={cn('font-bold', className)} disabled>
        <CheckCircle2 className="mr-1.5 h-4 w-4 text-primary" />
        Tu plan
      </Button>
    )
  }

  if (!canChangePlan) {
    return (
      <Button variant="outline" size={size} className={cn('font-semibold', className)} disabled>
        Solo el propietario
      </Button>
    )
  }

  return (
    <Button
      asChild
      size={size}
      variant={direction === 'up' ? 'default' : 'outline'}
      className={cn('font-bold', className)}
    >
      <Link href={changePlanHref(plan.code)}>
        {direction === 'up' ? (
          <ArrowUpRight className="mr-1.5 h-4 w-4" />
        ) : direction === 'down' ? (
          <ArrowDownRight className="mr-1.5 h-4 w-4" />
        ) : null}
        {direction === 'up' ? `Subir a ${plan.name}` : direction === 'down' ? `Bajar a ${plan.name}` : `Elegir ${plan.name}`}
      </Link>
    </Button>
  )
}

function PlanCard({
  plan,
  direction,
  canChangePlan,
}: {
  plan: PlanRow
  direction: PlanDirection
  canChangePlan: boolean
}) {
  const isCurrent = direction === 'current'

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border bg-card transition-shadow',
        isCurrent ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-border hover:shadow-lg'
      )}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-6">
          <Badge className="gap-1 rounded-full border-0 bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground shadow-xs">
            <CheckCircle2 className="h-3 w-3" />
            Plan actual
          </Badge>
        </div>
      )}

      {plan.isPopular && !isCurrent && (
        <div className="absolute -top-3 left-6">
          <Badge className="gap-1 rounded-full border-0 bg-amber-500 px-3 py-0.5 text-xs font-bold text-white shadow-xs">
            <Star className="h-3 w-3 fill-white" />
            Más elegido
          </Badge>
        </div>
      )}

      <div className="p-6 pt-7">
        <h3 className="text-xl font-extrabold text-foreground">{plan.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-black tabular-nums text-foreground sm:text-3xl">{plan.priceLabel}</span>
          {plan.priceMonthly > 0 && <span className="text-xs font-semibold text-muted-foreground">/mes</span>}
        </div>
      </div>

      <div className="space-y-2.5 border-t border-border bg-muted/30 px-6 py-4">
        {resources.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </div>
            <span className="font-bold tabular-nums text-foreground">{plan[key] as string}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border px-6 py-4">
        {features.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">{label}</span>
            <FeatureValue value={plan[key]} label={label} />
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-border p-5">
        <PlanCta plan={plan} direction={direction} canChangePlan={canChangePlan} className="h-10 w-full rounded-2xl text-xs" />
      </div>
    </div>
  )
}

export function PlansComparison({ plans, currentPlanCode, canChangePlan }: Props) {
  const [view, setView] = useState<'table' | 'cards'>('cards')

  const currentPrice = plans.find((plan) => plan.code === currentPlanCode)?.priceMonthly ?? null

  // Con tres planes en una grilla de cuatro quedaba una columna vacia.
  const gridCols =
    plans.length >= 4
      ? 'sm:grid-cols-2 xl:grid-cols-4'
      : plans.length === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2'

  return (
    <Card className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-extrabold text-foreground">Comparativa de planes</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Los límites y beneficios de cada nivel, comparados con el tuyo
            </p>
          </div>
          <div
            role="group"
            aria-label="Forma de ver los planes"
            className="flex items-center gap-1 self-start rounded-xl border border-border bg-muted/60 p-1 sm:self-auto"
          >
            <Button
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-3 text-xs font-semibold"
              aria-pressed={view === 'cards'}
              onClick={() => setView('cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tarjetas
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-3 text-xs font-semibold"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
            >
              <List className="h-3.5 w-3.5" />
              Tabla
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {view === 'cards' ? (
          <div className={cn('grid gap-6 pt-2', gridCols)}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                direction={planDirection(plan, currentPrice, currentPlanCode)}
                canChangePlan={canChangePlan}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="text-xs font-bold">Plan</TableHead>
                  <TableHead className="text-xs font-bold">Precio</TableHead>
                  <TableHead className="text-xs font-bold">Usuarios</TableHead>
                  <TableHead className="text-xs font-bold">Sucursales</TableHead>
                  <TableHead className="text-xs font-bold">Cajas</TableHead>
                  <TableHead className="text-xs font-bold">Productos</TableHead>
                  {features.map(({ key, label }) => (
                    <TableHead key={key} className="text-xs font-bold">
                      {label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-xs font-bold" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const direction = planDirection(plan, currentPrice, currentPlanCode)
                  return (
                    <TableRow
                      key={plan.code}
                      className={cn('border-border', direction === 'current' && 'bg-primary/5 font-semibold')}
                    >
                      <TableCell className="text-xs font-bold">
                        <div className="flex items-center gap-2">
                          {plan.name}
                          {direction === 'current' && (
                            <Badge className="border-0 bg-primary px-2 py-0 text-[10px] text-primary-foreground">Actual</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold tabular-nums">{plan.priceLabel}</TableCell>
                      <TableCell className="text-xs tabular-nums">{plan.users}</TableCell>
                      <TableCell className="text-xs tabular-nums">{plan.branches}</TableCell>
                      <TableCell className="text-xs tabular-nums">{plan.cashRegisters}</TableCell>
                      <TableCell className="text-xs tabular-nums">{plan.products}</TableCell>
                      {features.map(({ key, label }) => (
                        <TableCell key={key} className="text-xs">
                          <FeatureValue value={plan[key]} label={label} />
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        {direction !== 'current' && canChangePlan && (
                          <PlanCta
                            plan={plan}
                            direction={direction}
                            canChangePlan={canChangePlan}
                            size="sm"
                            className="h-8 rounded-xl text-xs"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
