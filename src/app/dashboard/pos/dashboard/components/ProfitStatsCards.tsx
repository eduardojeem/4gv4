import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, PieChart, Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { PosStats } from "../hooks/usePosStats"

interface ProfitStatsCardsProps {
    stats: PosStats
}

export function ProfitStatsCards({ stats }: ProfitStatsCardsProps) {
    const { profitStats, totalSales } = stats

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                </div>
                Ganancias & Rentabilidad
                <Badge variant="outline" className="border-emerald-300 bg-emerald-100/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 text-[10px] font-bold">
                    Margen
                </Badge>
            </h3>

            <div className="grid gap-4 md:grid-cols-4">
                {/* Ganancia Bruta Ventas */}
                <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Ganancia Bruta Ventas
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(profitStats.salesProfit)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ventas ({formatCurrency(totalSales)}) − Costos ({formatCurrency(profitStats.totalCost)})
                        </p>
                    </CardContent>
                </Card>

                {/* Margen de Ganancia % */}
                <Card className="border border-teal-200/80 dark:border-teal-800/60 bg-gradient-to-br from-teal-50/60 to-transparent dark:from-teal-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-900/40">
                                <PieChart className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Margen de Ganancia
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-teal-700 dark:text-teal-400">
                            {profitStats.profitMargin.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Porcentaje de rentabilidad s/ ventas
                        </p>
                    </CardContent>
                </Card>

                {/* Ganancia por Reparaciones */}
                <Card className="border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                                <Layers className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Ganancia por Taller
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-amber-700 dark:text-amber-400">
                            {formatCurrency(profitStats.repairProfit)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Recaudado por reparaciones entregadas
                        </p>
                    </CardContent>
                </Card>

                {/* Ganancia Total Combinada */}
                <Card className="border border-indigo-200/80 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/60 to-transparent dark:from-indigo-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                                <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Ganancia Total Combinada
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-indigo-700 dark:text-indigo-400">
                            {formatCurrency(profitStats.totalProfit)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ventas + Reparaciones Entregadas
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
