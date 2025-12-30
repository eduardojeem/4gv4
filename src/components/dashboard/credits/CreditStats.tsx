import { CreditCard, Banknote, CalendarClock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { CreditRow, InstallmentRow } from '@/hooks/use-credits'
import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'

interface CreditStatsProps {
    credits: CreditRow[]
    installments: InstallmentRow[]
}

export function CreditStats({ credits, installments }: CreditStatsProps) {
    const stats = useMemo(() => {
        const isLate = (i: InstallmentRow) => i.status === 'pending' && new Date(i.due_date) < new Date()

        // Active Credits
        const activeCreditsCount = credits.filter(c => c.status === 'active').length
        const totalCreditsCount = credits.length

        // Pending Installments Count
        const pendingInstallmentsCount = installments.filter(i => i.status === 'pending').length

        // Late Installments Count
        const lateInstallmentsCount = installments.filter(i => i.status === 'late' || isLate(i)).length

        // Total Remaining Amount (Balance)
        const remainingAmount = installments
            .filter(i => i.status === 'pending' || i.status === 'late' || isLate(i))
            .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

        // Total amount (paid + pending)
        const totalAmount = installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        const paidAmount = totalAmount - remainingAmount

        // Collection rate
        const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

        // Late rate
        const lateRate = installments.length > 0 ? (lateInstallmentsCount / installments.length) * 100 : 0

        return [
            {
                title: 'Créditos Activos',
                value: String(activeCreditsCount),
                subtitle: `de ${totalCreditsCount} totales`,
                icon: CreditCard,
                color: 'blue',
                progress: totalCreditsCount > 0 ? (activeCreditsCount / totalCreditsCount) * 100 : 0,
                trend: null
            },
            {
                title: 'Saldo Pendiente',
                value: formatCurrency(remainingAmount),
                subtitle: `${collectionRate.toFixed(1)}% cobrado`,
                icon: Banknote,
                color: 'green',
                progress: collectionRate,
                trend: collectionRate > 70 ? 'up' : 'down'
            },
            {
                title: 'Cuotas Pendientes',
                value: String(pendingInstallmentsCount),
                subtitle: `${installments.filter(i => i.status === 'paid').length} pagadas`,
                icon: CalendarClock,
                color: 'orange',
                progress: installments.length > 0 ? ((installments.length - pendingInstallmentsCount) / installments.length) * 100 : 0,
                trend: null
            },
            {
                title: 'Cuotas Atrasadas',
                value: String(lateInstallmentsCount),
                subtitle: `${lateRate.toFixed(1)}% de morosidad`,
                icon: AlertTriangle,
                color: 'red',
                progress: 100 - lateRate,
                trend: lateRate < 10 ? 'up' : 'down'
            }
        ]
    }, [credits, installments])

    const colorClasses = {
        blue: {
            bg: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10',
            icon: 'text-blue-600 dark:text-blue-400',
            progress: 'bg-blue-600',
            border: 'border-blue-200 dark:border-blue-800'
        },
        green: {
            bg: 'from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10',
            icon: 'text-green-600 dark:text-green-400',
            progress: 'bg-green-600',
            border: 'border-green-200 dark:border-green-800'
        },
        orange: {
            bg: 'from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10',
            icon: 'text-orange-600 dark:text-orange-400',
            progress: 'bg-orange-600',
            border: 'border-orange-200 dark:border-orange-800'
        },
        red: {
            bg: 'from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10',
            icon: 'text-red-600 dark:text-red-400',
            progress: 'bg-red-600',
            border: 'border-red-200 dark:border-red-800'
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, idx) => {
                const Icon = stat.icon
                const colors = colorClasses[stat.color as keyof typeof colorClasses]

                return (
                    <Card
                        key={idx}
                        className={`border-2 ${colors.border} bg-gradient-to-br ${colors.bg} shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}
                    >
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">
                                        {stat.title}
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-3xl font-bold tracking-tight">
                                            {stat.value}
                                        </h3>
                                        {stat.trend && (
                                            <span className={`flex items-center text-xs ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                                {stat.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {stat.subtitle}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-xl bg-white/50 dark:bg-black/20 ${colors.icon}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                            </div>

                            {/* Visual Progress Bar */}
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Progreso</span>
                                    <span className="font-medium">{Math.round(stat.progress)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${colors.progress} transition-all duration-500 ease-out rounded-full`}
                                        style={{ width: `${stat.progress}%` }}
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
