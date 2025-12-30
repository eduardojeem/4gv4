import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ChevronDown, ChevronUp, DollarSign, Calendar, Percent, TrendingUp, Eye } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { CreditRow } from '@/hooks/use-credits'
import { useState } from 'react'

interface CreditListProps {
    credits: CreditRow[]
    remainingByCredit: Record<string, number>
    paidByCredit: Record<string, number>
    onRegisterPayment: (creditId: string) => void
    onViewDetail?: (creditId: string) => void
}

export function CreditList({
    credits,
    remainingByCredit,
    paidByCredit,
    onRegisterPayment,
    onViewDetail,
}: CreditListProps) {
    const [expandedCredit, setExpandedCredit] = useState<string | null>(null)

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700'
            case 'completed':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700'
            case 'defaulted':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700'
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-300 dark:border-gray-700'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }
    }

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Créditos Activos
                    <Badge variant="secondary" className="ml-2">{credits.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {credits.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No hay créditos activos</p>
                        </div>
                    ) : credits.map((c) => {
                        const paid = Number(paidByCredit[c.id] || 0)
                        const remaining = Number(remainingByCredit[c.id] || 0)
                        const total = paid + remaining
                        const progressPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                        const isExpanded = expandedCredit === c.id

                        return (
                            <div
                                key={c.id}
                                className="group border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 overflow-hidden"
                            >
                                {/* Main Content */}
                                <div className="p-5">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* Left: Credit Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h4 className="font-semibold text-base mb-1">
                                                        {c.customer_name || `Cliente ${c.customer_id}`}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        ID: {c.id}
                                                    </p>
                                                </div>
                                                <Badge className={`${getStatusColor(c.status)} font-medium`}>
                                                    {c.status === 'active' ? 'Activo' :
                                                        c.status === 'completed' ? 'Completado' :
                                                            c.status === 'defaulted' ? 'Moroso' : 'Cancelado'}
                                                </Badge>
                                            </div>

                                            {/* Quick Stats */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="h-4 w-4 text-green-600" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Principal</p>
                                                        <p className="text-sm font-semibold">{formatCurrency(c.principal)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-blue-600" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Plazo</p>
                                                        <p className="text-sm font-semibold">{c.term_months} meses</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Percent className="h-4 w-4 text-orange-600" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Interés</p>
                                                        <p className="text-sm font-semibold">{c.interest_rate}%</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="h-4 w-4 text-purple-600" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Progreso</p>
                                                        <p className="text-sm font-semibold">{progressPct}%</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                                    <span>Pagado: {formatCurrency(paid)}</span>
                                                    <span>Pendiente: {formatCurrency(remaining)}</span>
                                                </div>
                                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
                                                        style={{ width: `${progressPct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                                                onClick={() => onRegisterPayment(c.id)}
                                            >
                                                Registrar Pago
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full sm:w-auto"
                                                onClick={() => onViewDetail?.(c.id)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                Ver Detalle
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
