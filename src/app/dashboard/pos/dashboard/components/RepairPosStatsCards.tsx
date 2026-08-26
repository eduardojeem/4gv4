import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import Link from 'next/link'
import { Wrench, PackageCheck, CheckCircle2, ArrowRight, DollarSign, Calendar, TrendingUp, Search, ExternalLink, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { PosStats } from "../hooks/usePosStats"
import { format, parseISO } from 'date-fns'

interface RepairPosStatsCardsProps {
    stats: PosStats
}

export function RepairPosStatsCards({ stats }: RepairPosStatsCardsProps) {
    const { repairStats } = stats
    const [selectedRepair, setSelectedRepair] = useState<any | null>(null)

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
                            Facturación - Repuestos ({formatCurrency(repairStats.deliveredPartsCost)})
                            {repairStats.refundsAmount > 0 && ` - Devoluciones (${formatCurrency(repairStats.refundsAmount)})`}
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
                                            <th className="px-4 py-3 font-medium text-right">Costo Repuestos</th>
                                            <th className="px-4 py-3 font-medium text-right">Ganancia Neta</th>
                                            <th className="px-4 py-3 font-medium">Estado de Pago</th>
                                            <th className="px-4 py-3 font-medium w-12 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {repairStats.deliveredRepairs.map((r) => {
                                            const totalBilled = Number(r.final_cost ?? r.estimated_cost ?? r.paid_amount ?? 0)
                                            const partsCost = Number(r.parts_cost ?? 0)
                                            const laborCost = Number(r.labor_cost ?? 0)
                                            const net = totalBilled - partsCost
                                            
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
                                                        {formatCurrency(partsCost)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                        {formatCurrency(net)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {paymentBadge}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                                                            onClick={() => setSelectedRepair(r)}
                                                        >
                                                            <Search className="h-4 w-4" />
                                                            <span className="sr-only">Ver detalle</span>
                                                        </Button>
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

            {/* Nueva tabla de Créditos por Reparaciones */}
            <Card className="mt-6 border-slate-200 dark:border-slate-800">
                <CardHeader className="py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-rose-500" />
                        Créditos por Reparaciones (Deuda Activa)
                    </CardTitle>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Pendiente</p>
                        <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(stats.repairCreditStats?.pendingAmount || 0)}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="max-h-[300px]">
                        <div className="min-w-[800px]">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Fecha</th>
                                        <th className="px-4 py-3 font-medium">Cliente</th>
                                        <th className="px-4 py-3 font-medium">Referencia</th>
                                        <th className="px-4 py-3 font-medium text-right">Deuda Original</th>
                                        <th className="px-4 py-3 font-medium text-right">Saldo Pendiente</th>
                                        <th className="px-4 py-3 font-medium">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {(!stats.allRepairCredits || stats.allRepairCredits.length === 0) ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-medium">
                                                No hay créditos por reparaciones en este periodo
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.allRepairCredits.map((credit: any) => (
                                            <tr key={credit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3 text-slate-500">
                                                    {new Date(credit.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                                                    {credit.customer?.name || 'Desconocido'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {credit.label || 'Reparación'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                    {formatCurrency(Number(credit.totalDebt) || 0)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(Number(credit.pendingDebt) || 0)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {credit.status === 'active' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900 dark:text-blue-200">Activo</span>}
                                                    {credit.status === 'paid' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900 dark:text-emerald-200">Pagado</span>}
                                                    {credit.status === 'defaulted' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 border-transparent dark:bg-rose-900 dark:text-rose-200">En Mora</span>}
                                                    {credit.status === 'cancelled' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800 border-transparent dark:bg-slate-800 dark:text-slate-300">Anulado</span>}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Modal de Detalle */}
            <Dialog open={!!selectedRepair} onOpenChange={(open) => !open && setSelectedRepair(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-amber-500" />
                            Detalle de Reparación
                        </DialogTitle>
                        <DialogDescription>
                            Información financiera y general de la reparación.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRepair && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Ticket</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedRepair.ticket_number || 'S/N'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-slate-500">Equipo</p>
                                    <p className="text-base font-semibold">{selectedRepair.device_brand} {selectedRepair.device_model}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase">Facturación Bruta</p>
                                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(Number(selectedRepair.final_cost ?? selectedRepair.estimated_cost ?? selectedRepair.paid_amount ?? 0))}
                                    </p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-xs text-slate-500 uppercase">Ganancia Neta</p>
                                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(Number(selectedRepair.final_cost ?? selectedRepair.estimated_cost ?? selectedRepair.paid_amount ?? 0) - Number(selectedRepair.parts_cost ?? 0))}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase">Costo Repuestos</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                        {formatCurrency(Number(selectedRepair.parts_cost ?? 0))}
                                    </p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-xs text-slate-500 uppercase">Mano de Obra</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                        {formatCurrency(Number(selectedRepair.labor_cost ?? 0))}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Estado de Pago:</p>
                                <Badge variant={selectedRepair.payment_status?.toLowerCase() === 'pagado' || selectedRepair.payment_status?.toLowerCase() === 'paid' ? 'default' : 'secondary'} className="uppercase text-xs font-bold">
                                    {selectedRepair.payment_status || 'Pendiente'}
                                </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Fecha de Entrega:</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {selectedRepair.delivered_at ? format(parseISO(selectedRepair.delivered_at), 'dd/MM/yyyy HH:mm') : '-'}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setSelectedRepair(null)}>Cerrar</Button>
                                <Button asChild className="gap-2">
                                    <Link href={`/dashboard/repairs?search=${selectedRepair.ticket_number}`}>
                                        Ver Taller Completo <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
