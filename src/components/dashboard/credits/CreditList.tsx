'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Users, DollarSign, Calendar, Percent, TrendingUp, Eye, LayoutGrid, List, Table2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatCustomerId, formatCreditId } from '@/lib/utils'
import { CreditRow } from '@/hooks/use-credits'

interface CreditListProps {
    credits: CreditRow[]
    remainingByCredit: Record<string, number>
    paidByCredit: Record<string, number>
    onRegisterPayment: (creditId: string) => void
    onViewDetail?: (creditId: string) => void
    viewMode?: 'cards' | 'list' | 'table'
    onChangeViewMode?: (mode: 'cards' | 'list' | 'table') => void
}

const avatarGradients = [
    'from-blue-500 to-blue-700', 'from-violet-500 to-violet-700',
    'from-emerald-500 to-emerald-700', 'from-rose-500 to-rose-700',
    'from-amber-500 to-amber-700', 'from-cyan-500 to-cyan-700',
    'from-indigo-500 to-indigo-700', 'from-fuchsia-500 to-fuchsia-700',
]
function getAvatarGradient(name: string) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
    return avatarGradients[Math.abs(h) % avatarGradients.length]
}

const statusLabel: Record<string, string> = {
    active: 'Activo', completed: 'Completado', defaulted: 'Moroso', cancelled: 'Cancelado'
}
const statusStyle: Record<string, string> = {
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    defaulted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
}

export function CreditList({
    credits,
    remainingByCredit,
    paidByCredit,
    onRegisterPayment,
    onViewDetail,
    viewMode = 'cards',
    onChangeViewMode,
}: CreditListProps) {

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
            <div className="p-4 rounded-full bg-muted/50 mb-3">
                <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No hay créditos activos</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Los créditos activos aparecerán aquí</p>
        </div>
    )

    const renderCards = () => (
        <div className="space-y-3">
            {credits.map((c) => {
                const paid = Number(paidByCredit[c.id] || 0)
                const remaining = Number(remainingByCredit[c.id] || 0)
                const total = paid + remaining
                const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                const name = c.customer_name || `Cliente ${c.customer_code || formatCustomerId(c.customer_id)}`
                const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
                const gradient = getAvatarGradient(name)

                return (
                    <div
                        key={c.id}
                        className="group rounded-xl border border-border/60 bg-white dark:bg-white/[0.03] hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all duration-200 overflow-hidden"
                    >
                        <div className="p-5">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                {/* Left: avatar + info */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className={`flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shadow-sm select-none`}>
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="font-semibold text-sm leading-tight truncate">{name}</h4>
                                            <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusStyle[c.status] ?? statusStyle.cancelled}`}>
                                                {statusLabel[c.status] ?? c.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono">{formatCreditId(c.id)}</p>

                                        {/* Metrics */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><DollarSign className="h-3 w-3" />Principal</p>
                                                <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.principal)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Calendar className="h-3 w-3" />Plazo</p>
                                                <p className="text-sm font-semibold">{c.term_months} meses</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Percent className="h-3 w-3" />Interés</p>
                                                <p className="text-sm font-semibold">{c.interest_rate}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><TrendingUp className="h-3 w-3" />Pagado</p>
                                                <p className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(paid)}</p>
                                            </div>
                                        </div>

                                        {/* Progress */}
                                        <div className="mt-3 space-y-1">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span className="tabular-nums">{formatCurrency(paid)} pagado</span>
                                                <span className="tabular-nums font-medium text-foreground">{pct}%</span>
                                                <span className="tabular-nums">{formatCurrency(remaining)} pendiente</span>
                                            </div>
                                            <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: actions */}
                                <div className="flex gap-2 lg:flex-col lg:items-stretch shrink-0">
                                    <Button
                                        size="sm"
                                        className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={() => onRegisterPayment(c.id)}
                                    >
                                        Registrar pago
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 lg:flex-none"
                                        onClick={() => onViewDetail?.(c.id)}
                                    >
                                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                                        Detalle
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderList = () => (
        <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/30">
            {credits.map((c, idx) => {
                const paid = Number(paidByCredit[c.id] || 0)
                const remaining = Number(remainingByCredit[c.id] || 0)
                const total = paid + remaining
                const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                const name = c.customer_name || `Cliente ${c.customer_code || formatCustomerId(c.customer_id)}`
                const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
                const gradient = getAvatarGradient(name)
                const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-white/[0.02]' : 'bg-slate-50/50 dark:bg-white/[0.01]'

                return (
                    <div key={c.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors ${rowBg}`}>
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[10px] font-bold select-none`}>
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{formatCreditId(c.id)}</p>
                        </div>
                        {/* Mini progress */}
                        <div className="hidden sm:flex flex-col items-end gap-1 w-28 shrink-0">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(paid)}</span>
                                <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">Pendiente</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(remaining)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => onRegisterPayment(c.id)}>Pago</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => onViewDetail?.(c.id)}>
                                <Eye className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderTable = () => (
        <div className="rounded-xl border border-border/50 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs uppercase tracking-wide">Cliente</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Crédito</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wide">Principal</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wide">Pagado</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wide">Pendiente</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Progreso</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">Estado</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {credits.map((c) => {
                        const paid = Number(paidByCredit[c.id] || 0)
                        const remaining = Number(remainingByCredit[c.id] || 0)
                        const total = paid + remaining
                        const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                        const name = c.customer_name || `Cliente ${c.customer_code || formatCustomerId(c.customer_id)}`
                        return (
                            <TableRow key={c.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10">
                                <TableCell className="font-medium text-sm">{name}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{formatCreditId(c.id)}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{formatCurrency(c.principal)}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-green-600 dark:text-green-400">{formatCurrency(paid)}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm font-semibold">{formatCurrency(remaining)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-20 bg-muted/60 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusStyle[c.status] ?? statusStyle.cancelled}`}>
                                        {statusLabel[c.status] ?? c.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => onRegisterPayment(c.id)}>Pago</Button>
                                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => onViewDetail?.(c.id)}>
                                            <Eye className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )

    return (
        <Card className="border border-border/60 shadow-sm bg-white dark:bg-white/[0.02]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4.5 w-4.5 text-blue-600" />
                    Créditos activos
                    <Badge variant="secondary" className="ml-1 text-xs">{credits.length}</Badge>
                </CardTitle>
                {/* View mode toggle — embedded in header */}
                {onChangeViewMode && (
                    <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
                        {([
                            { mode: 'cards' as const, Icon: LayoutGrid, label: 'Tarjetas' },
                            { mode: 'list' as const, Icon: List, label: 'Lista' },
                            { mode: 'table' as const, Icon: Table2, label: 'Tabla' },
                        ]).map(({ mode, Icon, label }) => (
                            <button
                                key={mode}
                                type="button"
                                title={label}
                                onClick={() => onChangeViewMode(mode)}
                                className={`flex items-center justify-center h-8 w-8 transition-colors ${viewMode === mode ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                            </button>
                        ))}
                    </div>
                )}
            </CardHeader>
            <CardContent className="pt-0">
                {credits.length === 0
                    ? renderEmpty()
                    : viewMode === 'table'
                        ? renderTable()
                        : viewMode === 'list'
                            ? renderList()
                            : renderCards()}
            </CardContent>
        </Card>
    )
}
