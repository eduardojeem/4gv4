import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, PieChart, Layers, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useState } from 'react'
import type { PosStats } from "../hooks/usePosStats"
import { figuresForMode, type TaxMode } from "../lib/pos-profit"

interface ProfitStatsCardsProps {
    stats: PosStats
}

export function ProfitStatsCards({ stats }: ProfitStatsCardsProps) {
    const { profitStats } = stats

    // Sin costo no hay ganancia que afirmar: se avisa en lugar de mostrar
    // numeros que parecerian calculados.
    if (profitStats.costUnavailable) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    Ganancias &amp; Rentabilidad
                </h3>
                <Card className="border border-amber-300/80 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20">
                    <CardContent className="p-5 space-y-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            No se pudo calcular el costo de mercadería
                        </p>
                        <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                            La ganancia y el margen no se muestran para no informar cifras sin respaldo.
                            La facturación y las reparaciones del período siguen siendo válidas.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Con IVA por defecto: el negocio cuenta el IVA cobrado como parte de su
    // ganancia. El interruptor no vuelve a consultar: ambas bases ya vienen
    // calculadas.
    const [taxMode, setTaxMode] = useState<TaxMode>('with-tax')
    const figures = figuresForMode(profitStats, taxMode)
    const isLoss = figures.salesProfit < 0
    const withoutTax = taxMode === 'without-tax'

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

                <div className="ml-auto flex items-center gap-2">
                    {profitStats.taxTotal > 0 && (
                        <span className="hidden sm:inline text-[11px] font-normal text-muted-foreground tabular-nums">
                            IVA del período: {formatCurrency(profitStats.taxTotal)}
                        </span>
                    )}
                    <div role="group" aria-label="Base de cálculo" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                        {([
                            { mode: 'with-tax' as const, label: 'Con IVA' },
                            { mode: 'without-tax' as const, label: 'Sin IVA' },
                        ]).map((option) => (
                            <button
                                key={option.mode}
                                type="button"
                                onClick={() => setTaxMode(option.mode)}
                                aria-pressed={taxMode === option.mode}
                                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                    taxMode === option.mode
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
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
                        <p className={`text-2xl font-bold tracking-tight tabular-nums ${isLoss ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {formatCurrency(figures.salesProfit)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {withoutTax ? 'Ventas sin IVA' : 'Ventas'} ({formatCurrency(figures.revenue)}) - Costos ({formatCurrency(profitStats.totalCost)})
                            {stats.refunds?.salesAmount > 0 && ` - Devoluciones (${formatCurrency(stats.refunds.salesAmount)})`}
                            {profitStats.itemsWithoutCost > 0 && (
                                <span className="block text-amber-700 dark:text-amber-400 mt-0.5">
                                    {profitStats.itemsWithoutCost} ítem(s) sin costo cargado
                                </span>
                            )}
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
                            Margen (Solo Ventas)
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-teal-700 dark:text-teal-400">
                            {figures.profitMargin.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Rentabilidad sobre las ventas
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
                            {formatCurrency(figures.totalProfit)}
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
