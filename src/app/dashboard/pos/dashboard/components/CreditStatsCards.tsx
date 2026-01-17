import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Wallet, Calendar, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { PosStats } from "../hooks/usePosStats"

interface CreditStatsCardsProps {
    stats: PosStats
}

export function CreditStatsCards({ stats }: CreditStatsCardsProps) {
    const { creditStats } = stats

    if (!creditStats || creditStats.count === 0) {
        return null
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-violet-600" />
                Resumen de Ventas a Crédito
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-violet-500 shadow-sm bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-gray-950">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Emitidos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(creditStats.totalAmount)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {creditStats.count} transacciones a crédito
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio (Crédito)</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(creditStats.averageTicket)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Promedio por venta a crédito
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-pink-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Deuda Activa del Periodo</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(creditStats.pendingAmount)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Pendiente de cobro (Status: Active)
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}