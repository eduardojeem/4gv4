import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Clock,
  Sparkles
} from "lucide-react"
import { Customer } from "@/hooks/use-customer-state"
import { formatCurrency } from "@/lib/currency"
import { StoreCreditCard } from "./StoreCreditCard"

type CreditSummary = {
  credit_id: string
  total_principal: number
  total_installments: number
  total_pagado: number
  saldo_pendiente: number
  progreso: number
} | null

interface CustomerDetailMetricsProps {
  customer: Customer & { credit_summary?: CreditSummary }
}

export function CustomerDetailMetrics({ customer }: CustomerDetailMetricsProps) {
  const creditSummary = customer.credit_summary
  const metrics = [
    {
      label: "Total Gastado",
      value: formatCurrency(customer.lifetime_value || 0),
      icon: ShoppingBag,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/20",
      border: "border-slate-200 dark:border-white/10"
    },
    {
      label: "Crédito Disponible",
      value: formatCurrency((customer.credit_limit || 0) - (customer.current_balance || 0)),
      subtext: `Límite: ${formatCurrency(customer.credit_limit || 0)}`,
      icon: CreditCard,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-500/20",
      border: "border-slate-200 dark:border-white/10"
    },
    {
      label: "Pedidos Totales",
      value: `${customer.total_purchases || 0}`,
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      border: "border-slate-200 dark:border-white/10"
    },
    {
      label: "Última Visita",
      value: customer.last_visit ? new Date(customer.last_visit).toLocaleDateString('es-PY') : "N/A",
      subtext: "Actividad registrada",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
      border: "border-slate-200 dark:border-white/10"
    }
  ]

  const prediction = (() => {
    if (!customer.total_purchases || customer.total_purchases < 2 || !customer.registration_date || !customer.last_visit) return null;
    const regDate = new Date(customer.registration_date);
    const lastDate = new Date(customer.last_visit);
    const now = new Date();
    const daysSinceReg = Math.max(1, (now.getTime() - regDate.getTime()) / (1000 * 3600 * 24));
    const avgDays = daysSinceReg / customer.total_purchases;
    const nextDate = new Date(lastDate.getTime() + (avgDays * 1000 * 3600 * 24));
    const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    return { diffDays, avgDays: Math.round(avgDays) };
  })();

  if (prediction) {
    metrics.push({
      label: "Próxima Compra (Est.)",
      value: prediction.diffDays > 0 ? `En ${prediction.diffDays} días` : "Muy pronto",
      subtext: `Frecuencia: ~${prediction.avgDays} días`,
      icon: Sparkles,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
      border: "border-slate-200 dark:border-white/10"
    });
  }

  if (creditSummary) {
    metrics.push(
      {
        label: "Saldo Pendiente",
        value: formatCurrency(creditSummary.saldo_pendiente || 0),
        subtext: `Principal ${formatCurrency(creditSummary.total_principal || 0)}`,
        icon: CreditCard,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-100 dark:bg-rose-500/20",
        border: "border-rose-200 dark:border-rose-500/30"
      },
      {
        label: "Progreso Crédito",
        value: `${creditSummary.progreso ?? 0}%`,
        subtext: `Pagado ${formatCurrency(creditSummary.total_pagado || 0)}`,
        icon: TrendingUp,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-100 dark:bg-indigo-500/20",
        border: "border-slate-200 dark:border-white/10"
      }
    )
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
