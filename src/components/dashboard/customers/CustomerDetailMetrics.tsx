import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
    TrendingUp,
    ShoppingBag,
    CreditCard,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles
} from "lucide-react"
import { Customer } from "@/hooks/use-customer-state"

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
            value: `$${(customer.lifetime_value || 0).toLocaleString()}`,
            change: "+12.5%",
            trend: "up",
            icon: ShoppingBag,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
        },
        {
            label: "Crédito Disponible",
            value: `$${((customer.credit_limit || 0) - (customer.current_balance || 0)).toLocaleString()}`,
            subtext: `de $${(customer.credit_limit || 0).toLocaleString()}`,
            icon: CreditCard,
            color: "text-purple-600",
            bg: "bg-purple-50 dark:bg-purple-900/20"
        },
        {
            label: "Pedidos Totales",
            value: `${customer.total_purchases || 0}`,
            change: "+2",
            trend: "up",
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-50 dark:bg-green-900/20"
        },
        {
            label: "Última Visita",
            value: customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : "N/A",
            subtext: "Última actividad registrada",
            icon: Clock,
            color: "text-orange-600",
            bg: "bg-orange-50 dark:bg-orange-900/20"
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
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20"
        });
    }
        if (creditSummary) {
            metrics.push(
                {
                    label: "Saldo Pendiente",
                    value: `$${(creditSummary.saldo_pendiente || 0).toLocaleString()}`,
                    subtext: `Principal $${(creditSummary.total_principal || 0).toLocaleString()}`,
                    icon: CreditCard,
                    color: "text-red-600",
                    bg: "bg-red-50 dark:bg-red-900/20"
                },
                {
                label: "Progreso Crédito",
                value: `${creditSummary.progreso ?? 0}%`,
                subtext: `Pagado $${(creditSummary.total_pagado || 0).toLocaleString()} de $${(creditSummary.total_installments || 0).toLocaleString()}`,
                icon: TrendingUp,
                color: "text-indigo-600",
                bg: "bg-indigo-50 dark:bg-indigo-900/20"
            }
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
                <Card key={index} className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                                    {metric.label}
                                </p>
                                <h3 className="text-2xl font-bold tabular-nums text-foreground mt-2">
                                    {metric.value}
                                </h3>
                                {metric.subtext && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {metric.subtext}
                                    </p>
                                )}
                                {metric.change && (
                                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {metric.trend === 'up' ? (
                                            <ArrowUpRight className="h-3 w-3" />
                                        ) : (
                                            <ArrowDownRight className="h-3 w-3" />
                                        )}
                                        {metric.change} vs mes anterior
                                    </div>
                                )}
                            </div>
                            <div className={`p-3 rounded-xl ${metric.bg}`}>
                                <metric.icon className={`h-5 w-5 ${metric.color}`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
