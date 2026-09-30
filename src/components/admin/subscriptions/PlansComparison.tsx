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
  Wrench,
  Camera,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PLAN_FEATURES, PLAN_FEATURE_GROUP_LABEL, type PlanFeatureGroup } from '@/lib/saas/plan-feature-catalog'
import { PLAN_LIMIT_FIELDS, formatPlanLimit, type PlanLimitKey } from '@/lib/saas/plan-limits'

export type PlanRow = {
  code: string
  name: string
  priceLabel: string
  priceMonthly: number
  /** Número, null (sin límite) o undefined (el plan no lo define). */
  limits: Partial<Record<PlanLimitKey, number | null>>
  /** Clave del catálogo de funciones → incluida o no. */
  included: Record<string, boolean>
  isPopular?: boolean
}

type Props = {
  plans: PlanRow[]
  currentPlanCode: string
  canChangePlan: boolean
}

const LIMIT_ICONS: Record<PlanLimitKey, typeof Users> = {
  users: Users,
  branches: Building2,
  cashRegisters: CreditCard,
  products: Package,
  repairs: Wrench,
  repairPhotos: Camera,
}

const GROUPS: PlanFeatureGroup[] = ['venta', 'operacion', 'gestion', 'servicio']

/**
 * Todas las funciones del catálogo, las mismas que edita el superadmin. Antes
 * se mostraban tres (marketplace, analytics y créditos) y no se veía en qué
 * plan venían Visitas web, Seguridad y auditoría, Pedidos o Promociones.
 */
const FEATURE_GROUPS = GROUPS.map((group) => ({
  group,
  label: PLAN_FEATURE_GROUP_LABEL[group],
  features: PLAN_FEATURES.filter((feature) => feature.group === group),
}))

function limitText(key: PlanLimitKey, value: number | null | undefined) {
  if (value === undefined) return '—'
  if (value === 0) return 'No incluye'
  return formatPlanLimit(key, value)
}

/**
 * Un tilde o una cruz no dicen nada en voz alta, y la vista de tabla mostraba
 * el mismo dato como texto: la misma informacion en dos idiomas distintos.
 */
function FeatureValue({ value, label }: { value: boolean; label: string }) {
  if (value) {
    return (
      <>
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <span className="sr-only">{label}: incluido</span>
      </>
    )
  }
  return (
    <>
      <X className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      <span className="sr-only">{label}: no incluido</span>
    </>
  )
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={span} className="py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  )
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
        {PLAN_LIMIT_FIELDS.map(({ key, label }) => {
          const Icon = LIMIT_ICONS[key]
          return (
            <div key={key} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </div>
              <span className="font-bold tabular-nums text-foreground">{limitText(key, plan.limits[key])}</span>
            </div>
          )
        })}
      </div>

      <div className="space-y-4 border-t border-border px-6 py-4">
        {FEATURE_GROUPS.map(({ group, label, features }) => (
          <div key={group} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{label}</p>
            {features.map((feature) => (
              <div key={feature.key} className="flex items-center justify-between gap-2 text-xs" title={feature.hint}>
                <span className={cn('font-medium', plan.included[feature.key] ? 'text-foreground' : 'text-muted-foreground')}>
                  {feature.label}
                </span>
                <FeatureValue value={Boolean(plan.included[feature.key])} label={feature.label} />
              </div>
            ))}
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
            {/* Funciones en filas y planes en columnas: con 17 funciones, una
                columna por función no entraba en pantalla. */}
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="text-xs font-bold">Qué incluye</TableHead>
                  {plans.map((plan) => {
                    const isCurrent = plan.code === currentPlanCode
                    return (
                      <TableHead key={plan.code} className={cn('text-center text-xs font-bold', isCurrent && 'bg-primary/5')}>
                        <div className="flex flex-col items-center gap-0.5 py-1">
                          <span className="flex items-center gap-1.5">
                            {plan.name}
                            {isCurrent && (
                              <Badge className="border-0 bg-primary px-2 py-0 text-[10px] text-primary-foreground">Actual</Badge>
                            )}
                          </span>
                          <span className="font-semibold tabular-nums text-muted-foreground">
                            {plan.priceLabel}
                            {plan.priceMonthly > 0 ? '/mes' : ''}
                          </span>
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                <GroupRow label="Límites" span={plans.length + 1} />
                {PLAN_LIMIT_FIELDS.map(({ key, label }) => (
                  <TableRow key={key} className="border-border">
                    <TableCell className="text-xs font-medium">{label}</TableCell>
                    {plans.map((plan) => (
                      <TableCell
                        key={plan.code}
                        className={cn('text-center text-xs font-semibold tabular-nums', plan.code === currentPlanCode && 'bg-primary/5')}
                      >
                        {limitText(key, plan.limits[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {FEATURE_GROUPS.flatMap(({ group, label, features }) => [
                  <GroupRow key={`group-${group}`} label={label} span={plans.length + 1} />,
                  ...features.map((feature) => (
                    <TableRow key={feature.key} className="border-border">
                      <TableCell className="text-xs">
                        <span className="font-medium">{feature.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{feature.hint}</span>
                      </TableCell>
                      {plans.map((plan) => (
                        <TableCell key={plan.code} className={cn('text-center', plan.code === currentPlanCode && 'bg-primary/5')}>
                          <span className="inline-flex justify-center">
                            <FeatureValue value={Boolean(plan.included[feature.key])} label={`${feature.label} en ${plan.name}`} />
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  )),
                ])}
                {canChangePlan && (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell />
                    {plans.map((plan) => {
                      const direction = planDirection(plan, currentPrice, currentPlanCode)
                      return (
                        <TableCell key={plan.code} className="text-center">
                          {direction !== 'current' && (
                            <PlanCta plan={plan} direction={direction} canChangePlan={canChangePlan} size="sm" className="h-8 rounded-xl text-xs" />
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
