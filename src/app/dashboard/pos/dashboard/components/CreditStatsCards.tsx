import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Wallet, AlertCircle } from 'lucide-react'
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
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40">
                    <CreditCard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                Resumen de Ventas a Crédito
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border border-indigo-200/80 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                                <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Créditos Emitidos</p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-indigo-700 dark:text-indigo-400">
                            {formatCurrency(creditStats.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {creditStats.count} transacciones a crédito
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-fuchsia-200/80 dark:border-fuchsia-800/60 bg-gradient-to-br from-fuchsia-50/50 to-transparent dark:from-fuchsia-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/40">
                                <CreditCard className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Ticket Promedio (Crédito)</p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-fuchsia-700 dark:text-fuchsia-400">
                            {formatCurrency(creditStats.averageTicket)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Promedio por venta a crédito
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/50 to-transparent dark:from-rose-950/20 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40">
                                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Deuda Activa del Periodo</p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-rose-700 dark:text-rose-400">
                            {formatCurrency(creditStats.pendingAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Pendiente de cobro (Activo)
                        </p>
                    </CardContent>
                </Card>
            </div>

            {stats.allCredits && stats.allCredits.length > 0 && (
                <Card className="border border-border/60 shadow-sm overflow-hidden bg-card mt-6">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Fecha</th>
                                    <th className="px-4 py-3 font-medium">Cliente</th>
                                    <th className="px-4 py-3 font-medium">Referencia (Venta)</th>
                                    <th className="px-4 py-3 font-medium text-right">Monto Original</th>
                                    <th className="px-4 py-3 font-medium">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {stats.allCredits.map((credit) => (
                                    <tr key={credit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 text-slate-500">
                                            {new Date(credit.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                                            {credit.customer?.name || 'Desconocido'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {credit.sale?.code || 'S/N'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                            {formatCurrency(Number(credit.principal) || 0)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {credit.status === 'active' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900 dark:text-blue-200">Activo</span>}
                                            {credit.status === 'paid' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900 dark:text-emerald-200">Pagado</span>}
                                            {credit.status === 'defaulted' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 border-transparent dark:bg-rose-900 dark:text-rose-200">En Mora</span>}
                                            {credit.status === 'cancelled' && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800 border-transparent dark:bg-slate-800 dark:text-slate-300">Anulado</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    )
}