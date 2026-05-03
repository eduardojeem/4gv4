'use client'
import { CreditCard, Banknote, CalendarClock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { CreditRow, InstallmentRow, isInstallmentLate } from '@/hooks/use-credits'
import { useMemo } from 'react'

interface CreditStatsProps {
    credits: CreditRow[]
    installments: InstallmentRow[]
}

export function CreditStats({ credits, installments }: CreditStatsProps) {
    const stats = useMemo(() => {
        const activeCreditsCount = credits.filter(c => c.status === 'active').length
        const totalCreditsCount = credits.length

        const pendingInstallmentsCount = installments.filter(i => i.status === 'pending').length
        // Use shared helper — consistent with the rest of the module
        const lateInstallmentsCount = installments.filter(i => isInstallmentLate(i)).length

        const remainingAmount = installments
            .filter(i => i.status === 'pending' || i.status === 'late' || isInstallmentLate(i))
            .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

        const totalAmount = installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        const paidAmount = totalAmount - remainingAmount

        const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
        const lateRate = installments.length > 0 ? (lateInstallmentsCount / installments.length) * 100 : 0

        return [
            {
                title: 'Créditos Activos',
                value: String(activeCreditsCount),
                subtitle: `de ${totalCreditsCount} total${totalCreditsCount !== 1 ? 'es' : ''}`,
                icon: CreditCard,
                color: 'blue' as const,
                progress: totalCreditsCount > 0 ? (activeCreditsCount / totalCreditsCount) * 100 : 0,
                trend: null,
                progressLabel: 'Activos vs total'
            },
            {
                title: 'Saldo Pendiente',
                value: formatCurrency(remainingAmount),
                subtitle: `${collectionRate.toFixed(1)}% cobrado`,
                icon: Banknote,
                color: 'green' as const,
                progress: collectionRate,
                trend: (collectionRate > 70 ? 'up' : 'down') as 'up' | 'down',
                progressLabel: 'Tasa de cobranza'
            },
            {
                title: 'Cuotas Pendientes',
                value: String(pendingInstallmentsCount),
                subtitle: `${installments.filter(i => i.status === 'paid').length} pagadas`,
                icon: CalendarClock,
                color: 'orange' as const,
                progress: installments.length > 0 ? ((installments.length - pendingInstallmentsCount) / installments.length) * 100 : 0,
                trend: null,
                progressLabel: 'Completadas vs total'
            },
            {
                title: 'Cuotas Atrasadas',
                value: String(lateInstallmentsCount),
                subtitle: `${lateRate.toFixed(1)}% de morosidad`,
                icon: AlertTriangle,
                color: 'red' as const,
                progress: 100 - lateRate,
                trend: (lateRate < 10 ? 'up' : 'down') as 'up' | 'down',
                progressLabel: 'Salud de cartera'
            }
        ]
    }, [credits, installments])

    const colorClasses = {
        blue: {
            card: 'border-blue-200/80 dark:border-blue-800/60',
            iconWrap: 'bg-blue-100 dark:bg-blue-900/40',
            icon: 'text-blue-600 dark:text-blue-400',
            bar: 'bg-blue-500',
            barTrack: 'bg-blue-100 dark:bg-blue-900/30',
            value: 'text-blue-700 dark:text-blue-300',
        },
        green: {
            card: 'border-green-200/80 dark:border-green-800/60',
            iconWrap: 'bg-green-100 dark:bg-green-900/40',
            icon: 'text-green-600 dark:text-green-400',
            bar: 'bg-green-500',
            barTrack: 'bg-green-100 dark:bg-green-900/30',
            value: 'text-green-700 dark:text-green-300',
        },
        orange: {
            card: 'border-orange-200/80 dark:border-orange-800/60',
            iconWrap: 'bg-orange-100 dark:bg-orange-900/40',
            icon: 'text-orange-600 dark:text-orange-400',
            bar: 'bg-orange-500',
            barTrack: 'bg-orange-100 dark:bg-orange-900/30',
            value: 'text-orange-700 dark:text-orange-300',
        },
        red: {
            card: 'border-red-200/80 dark:border-red-800/60',
            iconWrap: 'bg-red-100 dark:bg-red-900/40',
            icon: 'text-red-600 dark:text-red-400',
            bar: 'bg-red-500',
            barTrack: 'bg-red-100 dark:bg-red-900/30',
            value: 'text-red-700 dark:text-red-300',
        }
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
                const Icon = stat.icon
                const c = colorClasses[stat.color]
                const pct = Math.round(stat.progress)

                return (
                    <Card
                        key={stat.title}
                        className={`border ${c.card} bg-white dark:bg-white/[0.03] shadow-sm hover:shadow-md transition-shadow duration-200`}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-2.5 rounded-xl ${c.iconWrap}`}>
                                    <Icon className={`h-5 w-5 ${c.icon}`} />
                                </div>
                                {stat.trend && (
                                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${stat.trend === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {stat.trend === 'up'
                                            ? <TrendingUp className="h-3 w-3" />
                                            : <TrendingDown className="h-3 w-3" />}
                                        {stat.trend === 'up' ? 'Bien' : 'Revisar'}
                                    </span>
                                )}
                            </div>

                            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">{stat.title}</p>
                            <p className={`text-2xl font-bold tracking-tight mb-0.5 ${c.value}`}>{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.subtitle}</p>

                            {/* Progress bar */}
                            <div className="mt-4 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.progressLabel}</span>
                                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{pct}%</span>
                                </div>
                                <div className={`h-1.5 rounded-full overflow-hidden ${c.barTrack}`}>
                                    <div
                                        className={`h-full ${c.bar} rounded-full transition-all duration-700 ease-out`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
