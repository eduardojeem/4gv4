import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { Wrench, PackageCheck, CheckCircle2, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { PosStats } from "../hooks/usePosStats"

interface RepairPosStatsCardsProps {
    stats: PosStats
}

export function RepairPosStatsCards({ stats }: RepairPosStatsCardsProps) {
    const { repairStats } = stats

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Wrench className="h-4 w-4" />
                    </div>
                    Reparaciones & Taller del Período
                    <Badge variant="outline" className="border-amber-300 bg-amber-100/80 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200 text-[10px] font-bold">
                        Taller
                    </Badge>
                </h3>
                <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1 border-amber-300 dark:border-amber-800">
                    <Link href="/dashboard/repairs">
                        Ver Taller
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Monto Ingresado */}
                <Card className="border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                                <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Monto Reparaciones Ingresadas
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-amber-700 dark:text-amber-400">
                            {formatCurrency(repairStats.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Monto total de presupuestos ingresados
                        </p>
                    </CardContent>
                </Card>

                {/* Entregadas */}
                <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                                <PackageCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Monto Reparaciones Entregadas
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(repairStats.deliveredAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {repairStats.deliveredCount} equipo{repairStats.deliveredCount !== 1 ? 's' : ''} entregado{repairStats.deliveredCount !== 1 ? 's' : ''} al cliente
                        </p>
                    </CardContent>
                </Card>

                {/* Lista para Retiro */}
                <Card className="border border-blue-200/80 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/60 to-transparent dark:from-blue-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40">
                                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Monto Listo para Retiro
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-blue-700 dark:text-blue-400">
                            {formatCurrency(repairStats.readyAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {repairStats.readyCount} listo{repairStats.readyCount !== 1 ? 's' : ''} esper. retiro • {repairStats.activeCount} en proceso
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
