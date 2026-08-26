import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Wallet, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { PosStats } from "../hooks/usePosStats"

interface CreditStatsCardsProps {
    stats: PosStats
}

export function CreditStatsCards({ stats }: CreditStatsCardsProps) {
    const { creditStats } = stats

    if (!creditStats) {
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
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Monto Original Otorgado</p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                            {formatCurrency(creditStats.totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {creditStats.count} créditos emitidos
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-border/50 shadow-sm hover:shadow transition-shadow bg-card">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                <Wallet className="h-4 w-4 text-slate-500" />
                            </div>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Ticket Promedio</p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                            {formatCurrency(creditStats.averageTicket)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Por venta a crédito
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-rose-200/50 dark:border-rose-900/30 shadow-sm hover:shadow transition-shadow bg-gradient-to-br from-rose-50/30 to-transparent dark:from-rose-950/10 md:col-span-2">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40">
                                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
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

            <Card className="border border-border/60 shadow-sm overflow-hidden bg-card mt-6">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 font-medium uppercase tracking-wider">Cliente y Fecha</th>
                                <th className="px-6 py-4 font-medium uppercase tracking-wider">Referencia</th>
                                <th className="px-6 py-4 font-medium uppercase tracking-wider min-w-[200px]">Progreso de Pago</th>
                                <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Saldo Pendiente</th>
                                <th className="px-6 py-4 font-medium uppercase tracking-wider text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {(!stats.allCredits || stats.allCredits.length === 0) ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Wallet className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                            <p className="font-medium">No hay créditos emitidos en este periodo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                stats.allCredits.map((credit) => {
                                    const total = Number(credit.totalDebt) || 0
                                    const pending = Number(credit.pendingDebt) || 0
                                    const paid = total - pending
                                    const percentage = total > 0 ? (paid / total) * 100 : 0

                                    return (
                                        <tr key={credit.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                                        <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                            {credit.customer?.name || 'Cliente Casual'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(credit.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-300">
                                                    <Receipt className="h-3.5 w-3.5" />
                                                    {credit.sale?.code || credit.label || 'Venta S/N'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pagado: {formatCurrency(paid)}</span>
                                                        <span className="text-slate-500 font-medium">de {formatCurrency(total)}</span>
                                                    </div>
                                                    <div className="relative w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-bold ${pending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                        {formatCurrency(pending)}
                                                    </span>
                                                    {pending > 0 && (
                                                        <span className="text-[10px] uppercase font-semibold text-rose-500/70 mt-0.5">Falta Pagar</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {credit.status === 'active' && <span className="inline-flex items-center rounded-full border border-blue-200/50 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Activo</span>}
                                                {credit.status === 'paid' && <span className="inline-flex items-center rounded-full border border-emerald-200/50 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Pagado</span>}
                                                {credit.status === 'defaulted' && <span className="inline-flex items-center rounded-full border border-rose-200/50 px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 shadow-sm">En Mora</span>}
                                                {credit.status === 'cancelled' && <span className="inline-flex items-center rounded-full border border-slate-200/50 px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400">Anulado</span>}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}