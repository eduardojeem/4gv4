import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from 'next/link'
import { Wrench, PackageCheck, CheckCircle2, ArrowRight, DollarSign, Calendar, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { PosStats } from "../hooks/usePosStats"
import { format, parseISO } from 'date-fns'

interface RepairPosStatsCardsProps {
    stats: PosStats
}

export function RepairPosStatsCards({ stats }: RepairPosStatsCardsProps) {
    const { repairStats } = stats

    return (
        <div className="space-y-4 mt-6">
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Monto Ingresado */}
                <Card className="border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                                <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Presupuestos Ingresados
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-amber-700 dark:text-amber-400">
                            {formatCurrency(repairStats.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Monto total de equipos recibidos
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
                            Facturación (Retiradas)
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(repairStats.deliveredAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {repairStats.deliveredCount} entregado(s) - Ingreso Bruto
                        </p>
                    </CardContent>
                </Card>

                {/* Ganancia Neta */}
                <Card className="border border-indigo-200/80 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/60 to-transparent dark:from-indigo-950/20 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <TrendingUp className="w-24 h-24" />
                    </div>
                    <CardContent className="p-5 relative z-10">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                                <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                            Ganancia Neta (Taller)
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-indigo-700 dark:text-indigo-400">
                            {formatCurrency(repairStats.netProfit)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Facturación - Repuestos ({formatCurrency(repairStats.deliveredPartsCost)}) - MO ({formatCurrency(repairStats.deliveredLaborCost)})
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
                            Listo para Retiro
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-blue-700 dark:text-blue-400">
                            {formatCurrency(repairStats.readyAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {repairStats.readyCount} esperando ? {repairStats.activeCount} activos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {repairStats.deliveredRepairs && repairStats.deliveredRepairs.length > 0 && (
                <Card className="mt-6 border-slate-200 dark:border-slate-800">
                    <CardHeader className="py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-emerald-500" />
                            Detalle de Reparaciones Retiradas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[300px]">
                            <div className="min-w-[800px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Ticket</th>
                                            <th className="px-4 py-3 font-medium">Equipo</th>
                                            <th className="px-4 py-3 font-medium">Fecha Entrega</th>
                                            <th className="px-4 py-3 font-medium text-right">Facturado</th>
                                            <th className="px-4 py-3 font-medium text-right">Costos (Rep/MO)</th>
                                            <th className="px-4 py-3 font-medium text-right">Ganancia Neta</th>
                                            <th className="px-4 py-3 font-medium">Estado de Pago</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {repairStats.deliveredRepairs.map((r) => {
                                            const totalBilled = Number(r.final_cost ?? r.estimated_cost ?? r.paid_amount ?? 0)
                                            const partsCost = Number(r.parts_cost ?? 0)
                                            const laborCost = Number(r.labor_cost ?? 0)
                                            const net = totalBilled - partsCost - laborCost
                                            
                                            // Normalizar status de pago
                                            const paymentStatus = (r.payment_status || 'desconocido').toLowerCase()
                                            let paymentBadge = <Badge variant="outline" className="text-xs">{r.payment_status}</Badge>
                                            if (paymentStatus === 'pagado' || paymentStatus === 'paid') paymentBadge = <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Pagado</Badge>
                                            else if (paymentStatus === 'credito' || paymentStatus === 'crédito' || paymentStatus === 'credit') paymentBadge = <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Crédito</Badge>
                                            else if (paymentStatus === 'parcial' || paymentStatus === 'partial') paymentBadge = <Badge variant="outline" className="text-amber-600 border-amber-300">Parcial</Badge>

                                            return (
                                                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                        <Link href={`/dashboard/repairs?search=${r.ticket_number}`} className="hover:underline text-blue-600 dark:text-blue-400">
                                                            {r.ticket_number || 'S/N'}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                        {r.device_brand} {r.device_model}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        {r.delivered_at ? format(parseISO(r.delivered_at), 'dd/MM/yyyy HH:mm') : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(totalBilled)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-500">
                                                        {formatCurrency(partsCost)} <span className="text-slate-300">/</span> {formatCurrency(laborCost)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                        {formatCurrency(net)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {paymentBadge}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
