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
}

type Props = {
  plans: PlanRow[]
  currentPlanCode: string
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

function PlanCard({ plan, isCurrent }: { plan: PlanRow; isCurrent: boolean }) {
  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border bg-card transition-shadow hover:shadow-md',
      isCurrent && 'border-primary ring-2 ring-primary/20'
    )}>
      {isCurrent && (
        <div className="absolute -top-3 left-4">
          <Badge className="rounded-full bg-primary text-primary-foreground shadow gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Plan actual
          </Badge>
        </div>
      )}

      <div className="p-5 pt-7">
        <h3 className="text-lg font-bold">{plan.name}</h3>
        <div className="mt-2 flex items-end gap-1">
          <span className="text-2xl font-bold">{plan.priceLabel}</span>
          {plan.priceMonthly > 0 && (
            <span className="mb-0.5 text-xs text-muted-foreground">/mes</span>
          )}
        </div>
      </div>

      <div className="border-t px-5 py-4 space-y-2.5">
        {resources.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <span className="font-medium">{plan[key] as string}</span>
          </div>
        ))}
      </div>

      <div className="border-t px-5 py-3 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Marketplace</span>
          <FeatureValue value={plan.marketplace} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Analytics</span>
          <FeatureValue value={plan.analytics} />
        </div>
      </div>

      <div className="mt-auto border-t p-4">
        {isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Plan actual
          </Button>
        ) : (
          <Button asChild className="w-full" variant="outline">
            <Link href="/admin/subscriptions/change-plan">
              <CreditCard className="mr-2 h-4 w-4" />
              Cambiar a {plan.name}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}

export function PlansComparison({ plans, currentPlanCode }: Props) {
  const [view, setView] = useState<'table' | 'cards'>('table')

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Comparacion de planes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">El plan actual queda resaltado</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setView('table')}
            >
              <List className="h-3.5 w-3.5" />
              Tabla
            </Button>
            <Button
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setView('cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === 'cards' ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                isCurrent={plan.code === currentPlanCode}
              />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Sucursales</TableHead>
                <TableHead>Cajas</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Analytics</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const isCurrent = plan.code === currentPlanCode
                return (
                  <TableRow key={plan.code} className={cn(isCurrent && 'bg-muted/50')}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {plan.name}
                        {isCurrent && <Badge variant="secondary">Actual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{plan.priceLabel}</TableCell>
                    <TableCell>{plan.users}</TableCell>
                    <TableCell>{plan.branches}</TableCell>
                    <TableCell>{plan.cashRegisters}</TableCell>
                    <TableCell>{plan.products}</TableCell>
                    <TableCell>{plan.marketplace}</TableCell>
                    <TableCell>{plan.analytics}</TableCell>
                    <TableCell className="text-right">
                      {!isCurrent && (
                        <Button asChild size="sm" variant="outline">
                          <Link href="/admin/subscriptions/change-plan">Cambiar</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
