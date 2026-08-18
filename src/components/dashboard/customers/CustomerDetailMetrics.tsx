import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Clock,
  Sparkles,
  Coins
} from "lucide-react"
import { Customer } from "@/hooks/use-customer-state"
import { formatCurrency } from "@/lib/currency"
import { StoreCreditCard } from "./StoreCreditCard"

type CreditSummary = {
  credit_id?: string
  total_principal?: number
  total_installments?: number
  total_pagado?: number
  total_paid?: number
  saldo_pendiente?: number
  total_pending?: number
  progreso?: number
  available_credit?: number
  credit_limit?: number
  store_balance?: number
} | null

export interface CustomerStatsOverview {
  totalSpent?: number
  salesTotal?: number
  repairsTotal?: number
  totalPurchases?: number
  salesCount?: number
  repairsCount?: number
  lastVisit?: string | null
  averageTicket?: number
  pendingDebt?: number
  availableCredit?: number
  creditLimit?: number
  storeBalance?: number
}

interface CustomerDetailMetricsProps {
  customer: Customer & { credit_summary?: CreditSummary; credit_outstanding?: number }
  stats?: CustomerStatsOverview
}

export function CustomerDetailMetrics({ customer, stats }: CustomerDetailMetricsProps) {
  const creditSummary = customer.credit_summary
  /**
   * El saldo sale de las cuotas pendientes, no de `customers.current_balance`:
   * esa columna no la actualiza nadie, quedaba en 0 y el credito disponible se
   * mostraba siempre igual al limite aunque el cliente debiera todo. Es ademas
   * el mismo numero con el que el POS decide si puede vender a credito.
   */
  const creditLimit = stats?.creditLimit ?? creditSummary?.credit_limit ?? customer.credit_limit ?? 0
  const outstanding = stats?.pendingDebt ?? creditSummary?.total_pending ?? creditSummary?.saldo_pendiente ?? customer.credit_outstanding ?? 0
  const availableCredit = stats?.availableCredit ?? creditSummary?.available_credit ?? Math.max(0, creditLimit - outstanding)

  const effectiveSpent = stats?.totalSpent ?? (customer as any).total_spent_this_year ?? customer.lifetime_value ?? 0
  const effectivePurchases = stats?.totalPurchases ?? customer.total_purchases ?? 0
  const effectiveLastVisit = stats?.lastVisit ?? customer.last_visit ?? customer.last_activity ?? null

  const spentSubtext = stats?.salesCount !== undefined && stats?.repairsCount !== undefined
    ? `${stats.salesCount} ${stats.salesCount === 1 ? 'venta' : 'ventas'} · ${stats.repairsCount} ${stats.repairsCount === 1 ? 'reparación' : 'reparaciones'}`
    : "Histórico de compras y servicios"

  const purchasesSubtext = stats?.averageTicket && stats.averageTicket > 0
    ? `Promedio: ${formatCurrency(stats.averageTicket)}`
    : "Operaciones registradas"

  const metrics = [
    {
      label: "Total Gastado",
      value: formatCurrency(effectiveSpent),
      subtext: spentSubtext,
      icon: ShoppingBag,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/20",
      border: "border-slate-200 dark:border-white/10"
    },
    {
      label: "Crédito Disponible",
      value: formatCurrency(availableCredit),
      subtext: outstanding > 0
        ? `Límite ${formatCurrency(creditLimit)} · debe ${formatCurrency(outstanding)}`
        : `Límite: ${formatCurrency(creditLimit)}`,
      icon: CreditCard,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-500/20",
      border: "border-slate-200 dark:border-white/10"
    },
    {
      label: "Pedidos Totales",
      value: `${effectivePurchases}`,
      subtext: purchasesSubtext,
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      border: "border-slate-200 dark:border-white/10"
    },
    {
      label: "Última Visita",
      value: effectiveLastVisit ? new Date(effectiveLastVisit).toLocaleDateString('es-PY') : "Sin registro",
      subtext: "Actividad registrada",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
      border: "border-slate-200 dark:border-white/10"
    }
  ]

  if (outstanding > 0) {
    metrics.push({
      label: "Deuda Pendiente",
      value: formatCurrency(outstanding),
      subtext: creditLimit > 0 ? `${Math.min(100, Math.round((outstanding / creditLimit) * 100))}% de línea utilizada` : "Saldo por cobrar",
      icon: Coins,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-500/20",
      border: "border-rose-200 dark:border-rose-500/30"
    })
  }

  const prediction = (() => {
    if (!effectivePurchases || effectivePurchases < 2 || !customer.registration_date || !effectiveLastVisit) return null
    const regDate = new Date(customer.registration_date)
    const lastDate = new Date(effectiveLastVisit)
    const now = new Date()
    const daysSinceReg = Math.max(1, (now.getTime() - regDate.getTime()) / (1000 * 3600 * 24))
    const avgDays = daysSinceReg / effectivePurchases
    const nextDate = new Date(lastDate.getTime() + (avgDays * 1000 * 3600 * 24))
    const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 3600 * 24))

    return { diffDays, avgDays: Math.round(avgDays) }
  })()

  if (prediction) {
    metrics.push({
      label: "Próxima Compra (Est.)",
      value: prediction.diffDays > 0 ? `En ${prediction.diffDays} días` : "Muy pronto",
      subtext: `Frecuencia: ~${prediction.avgDays} días`,
      icon: Sparkles,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
      border: "border-slate-200 dark:border-white/10"
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <StoreCreditCard customerId={customer.id} />
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <Card key={index} className={`border bg-white transition-all hover:shadow-sm dark:bg-[#0d1117] ${metric.border}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {metric.label}
                </p>
                <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {metric.value}
                </p>
                {metric.subtext && (
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {metric.subtext}
                  </p>
                )}
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metric.bg}`}>
                <Icon className={`h-5 w-5 ${metric.color}`} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
