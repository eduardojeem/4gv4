import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    TrendingUp,
    ShoppingCart,
    Package,
    DollarSign,
    CreditCard
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { PosStats } from "../hooks/usePosStats"

interface PosStatsGridProps {
    stats: PosStats
}

export function PosStatsGrid({ stats }: PosStatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Totales</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        En el periodo seleccionado
                    </p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Transacciones</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tickets generados
                    </p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-violet-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.averageTicket)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Promedio por venta
                    </p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Producto Top</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.topProduct.sales}</div>
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={stats.topProduct.name}>
                        {stats.topProduct.name}
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
