'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { InstallmentRow, CreditRow } from '@/hooks/use-credits'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useState, useMemo } from 'react'

interface UpcomingInstallmentsProps {
    installments: InstallmentRow[]
    creditById: Record<string, CreditRow>
    onMarkPaid: (id: string, method: string, amount: number) => void
}

type GroupKey = 'overdue' | 'today' | 'thisWeek' | 'later'

type GroupedInstallments = Record<GroupKey, InstallmentRow[]>

const groupConfig: Record<GroupKey, {
    label: string
    Icon: typeof AlertCircle
    iconColor: string
    headerBg: string
    rowBorder: string
    dotColor: string
}> = {
    overdue: {
        label: 'Vencidas',
        Icon: AlertCircle,
        iconColor: 'text-red-600 dark:text-red-400',
        headerBg: 'bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-800',
        rowBorder: 'border-red-200/60 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700',
        dotColor: 'bg-red-500',
    },
    today: {
        label: 'Vencen hoy',
        Icon: Clock,
        iconColor: 'text-orange-600 dark:text-orange-400',
        headerBg: 'bg-orange-50/60 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
        rowBorder: 'border-orange-200/60 dark:border-orange-800/40 hover:border-orange-300 dark:hover:border-orange-700',
        dotColor: 'bg-orange-500',
    },
    thisWeek: {
        label: 'Esta semana',
        Icon: CalendarClock,
        iconColor: 'text-amber-600 dark:text-amber-400',
        headerBg: 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
        rowBorder: 'border-amber-200/60 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700',
        dotColor: 'bg-amber-500',
    },
    later: {
        label: 'Próximamente',
        Icon: CalendarClock,
        iconColor: 'text-blue-600 dark:text-blue-400',
        headerBg: 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
        rowBorder: 'border-blue-200/60 dark:border-blue-800/40 hover:border-blue-300 dark:hover:border-blue-700',
        dotColor: 'bg-blue-500',
    },
}

export function UpcomingInstallments({
    installments,
    creditById,
    onMarkPaid,
}: UpcomingInstallmentsProps) {
    const [methodByInstallment, setMethodByInstallment] = useState<Record<string, string>>({})
    const [amountByInstallment, setAmountByInstallment] = useState<Record<string, string>>({})
    const [errorById, setErrorById] = useState<Record<string, string>>({})

    const grouped = useMemo<GroupedInstallments>(() => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfWeek = new Date(today)
        endOfWeek.setDate(today.getDate() + 7)

        const groups: GroupedInstallments = { overdue: [], today: [], thisWeek: [], later: [] }
        installments.forEach(i => {
            const d = new Date(i.due_date); d.setHours(0, 0, 0, 0)
            if (d < today) groups.overdue.push(i)
            else if (d.getTime() === today.getTime()) groups.today.push(i)
            else if (d <= endOfWeek) groups.thisWeek.push(i)
            else groups.later.push(i)
        })
        return groups
    }, [installments])

    const handlePay = (i: InstallmentRow) => {
        const rawAmount = amountByInstallment[i.id]
        const amount = rawAmount !== undefined && rawAmount !== '' ? Number(rawAmount) : i.amount
        const method = methodByInstallment[i.id] || 'cash'

        if (!Number.isFinite(amount) || amount <= 0) {
            setErrorById(prev => ({ ...prev, [i.id]: 'El monto debe ser mayor a 0' }))
            return
        }
        setErrorById(prev => ({ ...prev, [i.id]: '' }))
        onMarkPaid(i.id, method, amount)
    }

    const renderGroup = (key: GroupKey) => {
        const items = grouped[key]
        if (items.length === 0) return null
        const cfg = groupConfig[key]
        const Icon = cfg.Icon
        const groupTotal = items
            .filter(i => i.status !== 'paid')
            .reduce((sum, i) => sum + (Number(i.amount || 0) - Math.min(Number(i.amount_paid || 0), Number(i.amount || 0))), 0)

        return (
            <div key={key} className="space-y-2">
                {/* Group header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.headerBg}`}>
                    <Icon className={`h-4 w-4 ${cfg.iconColor} flex-shrink-0`} />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.iconColor}`}>{cfg.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
                    <span className="ml-auto text-xs font-bold tabular-nums text-foreground">{formatCurrency(groupTotal)}</span>
                </div>

                {/* Installment rows */}
                <div className="space-y-1.5 pl-2">
                    {items.map(i => {
                        const paid = Number(i.amount_paid || 0)
                        const amt = Number(i.amount || 0)
                        const pct = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0
                        const customerName = creditById[i.credit_id]?.customer_name || 'Cliente'
                        const isPaid = i.status === 'paid'
                        const errorMsg = errorById[i.id]

                        return (
                            <div
                                key={i.id}
                                className={`rounded-xl border bg-white dark:bg-white/[0.03] transition-all duration-150 overflow-hidden ${cfg.rowBorder} ${isPaid ? 'opacity-60' : ''}`}
                            >
                                <div className="p-4">
                                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
                                        {/* Left info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <div>
                                                    <p className="text-sm font-semibold truncate leading-tight">{customerName}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Cuota <span className="font-mono font-bold">#{i.installment_number}</span>
                                                        {' · '}
                                                        {new Date(i.due_date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-base font-bold tabular-nums">{formatCurrency(i.amount)}</p>
                                                    {paid > 0 && <p className="text-[11px] text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(paid)} pag.</p>}
                                                </div>
                                            </div>

                                            {/* Progress bar (only if partial payment) */}
                                            {pct > 0 && pct < 100 && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-muted-foreground">Progreso parcial</span>
                                                        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{pct}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: action */}
                                        <div className="w-full lg:w-auto shrink-0">
                                            {isPaid ? (
                                                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
                                                    <CheckCircle className="h-4 w-4" />
                                                    Pagada
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Select
                                                            value={methodByInstallment[i.id] || 'cash'}
                                                            onValueChange={v => setMethodByInstallment(prev => ({ ...prev, [i.id]: v }))}
                                                        >
                                                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                                                <SelectValue placeholder="Método" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="cash">Efectivo</SelectItem>
                                                                <SelectItem value="card">Tarjeta</SelectItem>
                                                                <SelectItem value="transfer">Transferencia</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            type="number"
                                                            min={0.01}
                                                            step={0.01}
                                                            className={`w-[110px] h-8 text-xs ${errorMsg ? 'border-red-400' : ''}`}
                                                            value={amountByInstallment[i.id] ?? ''}
                                                            placeholder={String(i.amount)}
                                                            onChange={e => {
                                                                setAmountByInstallment(prev => ({ ...prev, [i.id]: e.target.value }))
                                                                if (errorMsg) setErrorById(prev => ({ ...prev, [i.id]: '' }))
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-4 bg-green-600 hover:bg-green-700 text-white text-xs"
                                                            onClick={() => handlePay(i)}
                                                        >
                                                            Cobrar
                                                        </Button>
                                                    </div>
                                                    {errorMsg && (
                                                        <p className="text-[11px] text-red-500 dark:text-red-400">{errorMsg}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const hasContent = Object.values(grouped).some(g => g.length > 0)

    return (
        <Card className="border border-border/60 shadow-sm bg-white dark:bg-white/[0.02]">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="h-4.5 w-4.5 text-orange-600" />
                    Próximas Cuotas
                    <Badge variant="secondary" className="ml-1 text-xs">{installments.length}</Badge>
                    {grouped.overdue.length > 0 && (
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse">
                            {grouped.overdue.length} vencida{grouped.overdue.length > 1 ? 's' : ''}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                {!hasContent ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
                        <div className="p-3 rounded-full bg-muted/50 mb-2">
                            <CalendarClock className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Sin cuotas pendientes</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Todas las cuotas están al día</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {(Object.keys(groupConfig) as GroupKey[]).map(key => renderGroup(key))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
