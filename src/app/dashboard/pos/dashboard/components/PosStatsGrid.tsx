import { Card, CardContent } from "@/components/ui/card"
import {
    TrendingUp,
    ShoppingCart,
    CreditCard,
    DollarSign
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { PosStats } from "../hooks/usePosStats"

interface PosStatsGridProps {
    stats: PosStats
}

export function PosStatsGrid({ stats }: PosStatsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Ventas Totales</p>
                    <p className="text-2xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(stats.totalSales)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        En el periodo seleccionado
                    </p>
                </CardContent>
            </Card>

            <Card className="border border-blue-200/80 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                        <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40">
                            <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Transacciones</p>
                    <p className="text-2xl font-bold tracking-tight tabular-nums text-blue-700 dark:text-blue-400">
                        {stats.totalTransactions}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tickets generados
                    </p>
                </CardContent>
            </Card>

            <Card className="border border-violet-200/80 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-950/20 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                        <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/40">
                            <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Ticket Promedio</p>
                    <p className="text-2xl font-bold tracking-tight tabular-nums text-violet-700 dark:text-violet-400">
                        {formatCurrency(stats.averageTicket)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Promedio por venta
                    </p>
                </CardContent>
            </Card>

            <Card className="border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                        <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Producto Top</p>
                    <p className="text-2xl font-bold tracking-tight tabular-nums text-amber-700 dark:text-amber-400">
                        {stats.topProduct.sales} <span className="text-base font-medium opacity-70">unidades</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={stats.topProduct.name}>
                        {stats.topProduct.name || "Sin datos"}
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
