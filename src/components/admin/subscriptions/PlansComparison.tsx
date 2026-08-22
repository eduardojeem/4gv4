'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
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

function FeatureValue({ value }: { value: string }) {
  if (value === 'Incluido') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (value === 'No incluido') return <X className="h-4 w-4 text-muted-foreground/40" />
  return <span className="text-xs font-medium">{value}</span>
}

function PlanCard({ plan, isCurrent, canChangePlan }: { plan: PlanRow; isCurrent: boolean; canChangePlan: boolean }) {
  return (
    <div className={cn(
      'relative flex flex-col rounded-3xl border bg-white dark:bg-slate-900 transition-all duration-300 hover:shadow-lg',
      isCurrent
        ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-400'
        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
    )}>
      {isCurrent && (
        <div className="absolute -top-3 left-6">
          <Badge className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs gap-1 text-xs px-3 py-0.5 font-bold border-0">
            <CheckCircle2 className="h-3 w-3" />
            Plan actual
          </Badge>
        </div>
      )}

      {plan.isPopular && !isCurrent && (
        <div className="absolute -top-3 left-6">
          <Badge className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs gap-1 text-xs px-3 py-0.5 font-bold border-0">
            <Star className="h-3 w-3 fill-white" />
            Más popular
          </Badge>
        </div>
      )}

      <div className="p-6 pt-7">
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{plan.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">{plan.priceLabel}</span>
          {plan.priceMonthly > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">/mes</span>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/20">
        {resources.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
              <Icon className="h-3.5 w-3.5 text-indigo-500" />
              {label}
            </div>
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{plan[key] as string}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Marketplace Web</span>
          <FeatureValue value={plan.marketplace} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Analytics & Reportes</span>
          <FeatureValue value={plan.analytics} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Créditos & Cuotas</span>
          <FeatureValue value={plan.credits} />
        </div>
      </div>

      <div className="mt-auto border-t border-slate-100 dark:border-slate-800 p-5">
        {isCurrent ? (
          <Button variant="outline" className="w-full rounded-2xl h-10 text-xs font-bold border-indigo-200 bg-indigo-50/50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300" disabled>
            <CheckCircle2 className="mr-1.5 h-4 w-4 text-indigo-600" />
            Plan actual
          </Button>
        ) : canChangePlan ? (
          <Button asChild className="w-full rounded-2xl h-10 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-xs" variant="default">
            <Link href="/admin/subscriptions/change-plan">
              <CreditCard className="mr-1.5 h-4 w-4" />
              Elegir {plan.name}
            </Link>
          </Button>
        ) : (
          <Button className="w-full rounded-2xl h-10 text-xs font-semibold" variant="outline" disabled>
            Solo propietario
          </Button>
        )}
      </div>
    </div>
  )
}

export function PlansComparison({ plans, currentPlanCode, canChangePlan }: Props) {
  const [view, setView] = useState<'table' | 'cards'>('cards')

  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Comparativa de Planes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Compara límites, módulos y beneficios de cada nivel</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 p-1 self-start sm:self-auto">
            <Button
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs rounded-lg font-semibold"
              onClick={() => setView('cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tarjetas
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs rounded-lg font-semibold"
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
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 pt-2">
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                isCurrent={plan.code === currentPlanCode}
                canChangePlan={canChangePlan}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/75 dark:bg-slate-800/50">
                <TableRow className="border-slate-100 dark:border-slate-800">
                  <TableHead className="font-bold text-xs">Plan</TableHead>
                  <TableHead className="font-bold text-xs">Precio</TableHead>
                  <TableHead className="font-bold text-xs">Usuarios</TableHead>
                  <TableHead className="font-bold text-xs">Sucursales</TableHead>
                  <TableHead className="font-bold text-xs">Cajas</TableHead>
                  <TableHead className="font-bold text-xs">Productos</TableHead>
                  <TableHead className="font-bold text-xs">Marketplace</TableHead>
                  <TableHead className="font-bold text-xs">Analytics</TableHead>
                  <TableHead className="font-bold text-xs">Créditos</TableHead>
                  <TableHead className="font-bold text-xs text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const isCurrent = plan.code === currentPlanCode
                  return (
                    <TableRow key={plan.code} className={cn('border-slate-100 dark:border-slate-800', isCurrent && 'bg-indigo-50/40 dark:bg-indigo-950/20 font-semibold')}>
                      <TableCell className="font-bold text-xs">
                        <div className="flex items-center gap-2">
                          {plan.name}
                          {isCurrent && <Badge className="bg-indigo-600 text-white border-0 text-[10px] py-0 px-2">Actual</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs">{plan.priceLabel}</TableCell>
                      <TableCell className="text-xs">{plan.users}</TableCell>
                      <TableCell className="text-xs">{plan.branches}</TableCell>
                      <TableCell className="text-xs">{plan.cashRegisters}</TableCell>
                      <TableCell className="text-xs">{plan.products}</TableCell>
                      <TableCell className="text-xs">{plan.marketplace}</TableCell>
                      <TableCell className="text-xs">{plan.analytics}</TableCell>
                      <TableCell className="text-xs">{plan.credits}</TableCell>
                      <TableCell className="text-right">
                        {!isCurrent && canChangePlan && (
                          <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs font-semibold">
                            <Link href="/admin/subscriptions/change-plan">Elegir</Link>
                          </Button>
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
