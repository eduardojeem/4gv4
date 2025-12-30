import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock, CheckCircle, AlertCircle, Clock, User } from 'lucide-react'
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

type GroupedInstallments = {
    overdue: InstallmentRow[]
    today: InstallmentRow[]
    thisWeek: InstallmentRow[]
    later: InstallmentRow[]
}

export function UpcomingInstallments({
    installments,
    creditById,
    onMarkPaid,
}: UpcomingInstallmentsProps) {
    // Local state for inline inputs in the list
    const [paymentMethodByInstallment, setPaymentMethodByInstallment] = useState<
        Record<string, string>
    >({})
    const [amountPaidByInstallment, setAmountPaidByInstallment] = useState<
        Record<string, number>
    >({})

    // Group installments by urgency
    const groupedInstallments = useMemo<GroupedInstallments>(() => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfWeek = new Date(today)
        endOfWeek.setDate(today.getDate() + 7)

        const groups: GroupedInstallments = {
            overdue: [],
            today: [],
            thisWeek: [],
            later: []
        }

        installments.forEach(i => {
            const dueDate = new Date(i.due_date)
            dueDate.setHours(0, 0, 0, 0)

            if (dueDate < today) {
                groups.overdue.push(i)
            } else if (dueDate.getTime() === today.getTime()) {
                groups.today.push(i)
            } else if (dueDate <= endOfWeek) {
                groups.thisWeek.push(i)
            } else {
                groups.later.push(i)
            }
        })

        return groups
    }, [installments])

    const getUrgencyStyle = (group: keyof GroupedInstallments) => {
        switch (group) {
            case 'overdue':
                return {
                    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300',
                    border: 'border-red-300 dark:border-red-700',
                    icon: AlertCircle,
                    iconColor: 'text-red-600'
                }
            case 'today':
                return {
                    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300',
                    border: 'border-orange-300 dark:border-orange-700',
                    icon: Clock,
                    iconColor: 'text-orange-600'
                }
            case 'thisWeek':
                return {
                    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300',
                    border: 'border-yellow-300 dark:border-yellow-700',
                    icon: CalendarClock,
                    iconColor: 'text-yellow-600'
                }
            default:
                return {
                    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300',
                    border: 'border-blue-300 dark:border-blue-700',
                    icon: CalendarClock,
                    iconColor: 'text-blue-600'
                }
        }
    }

    const renderInstallmentGroup = (
        title: string,
        items: InstallmentRow[],
        group: keyof GroupedInstallments
    ) => {
        if (items.length === 0) return null

        const style = getUrgencyStyle(group)
        const UrgencyIcon = style.icon

        return (
            <div key={group} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <UrgencyIcon className={`h-5 w-5 ${style.iconColor}`} />
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                        {title}
                    </h3>
                    <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                    {items.map((i) => {
                        const progressPct = typeof i.amount_paid === 'number' && i.amount > 0
                            ? Math.min(100, Math.round((Number(i.amount_paid) / Number(i.amount)) * 100))
                            : 0

                        return (
                            <div
                                key={i.id}
                                className={`border-2 ${style.border} rounded-xl bg-white dark:bg-gray-800/50 hover:shadow-md transition-all duration-300 overflow-hidden`}
                            >
                                <div className="p-4">
                                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                                        {/* Left: Installment Info */}
                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="font-medium text-sm truncate max-w-[200px]" title={creditById[i.credit_id]?.customer_name}>
                                                            {creditById[i.credit_id]?.customer_name || 'Cliente desconocido'}
                                                        </span>
                                                    </div>
                                                    <p className="font-semibold text-base">
                                                        Cuota #{i.installment_number}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Vence: {new Date(i.due_date).toLocaleDateString('es-AR', {
                                                            weekday: 'short',
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <p className="font-bold text-lg">
                                                        {formatCurrency(i.amount)}
                                                    </p>
                                                    {typeof i.amount_paid === 'number' && i.amount_paid > 0 && (
                                                        <p className="text-xs text-green-600 dark:text-green-400">
                                                            {formatCurrency(i.amount_paid)} pagado
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            {progressPct > 0 && (
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                                        <span>Progreso del pago</span>
                                                        <span className="font-medium">{progressPct}%</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="w-full lg:w-auto">
                                            {i.status === 'pending' || i.status === 'late' ? (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Select
                                                        value={paymentMethodByInstallment[i.id] || 'cash'}
                                                        onValueChange={(v) =>
                                                            setPaymentMethodByInstallment((prev) => ({
                                                                ...prev,
                                                                [i.id]: v,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[120px] h-9 text-sm">
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
                                                        className="w-[120px] h-9 text-sm"
                                                        value={
                                                            typeof amountPaidByInstallment[i.id] === 'number'
                                                                ? String(amountPaidByInstallment[i.id])
                                                                : ''
                                                        }
                                                        placeholder={String(i.amount)}
                                                        onChange={(e) => {
                                                            const v = Number(e.target.value)
                                                            setAmountPaidByInstallment((prev) => ({
                                                                ...prev,
                                                                [i.id]: v,
                                                            }))
                                                        }}
                                                    />
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-9 bg-green-600 hover:bg-green-700 px-4"
                                                        onClick={() => {
                                                            const method = paymentMethodByInstallment[i.id] || 'cash'
                                                            const amount = amountPaidByInstallment[i.id] !== undefined ? amountPaidByInstallment[i.id] : i.amount
                                                            onMarkPaid(i.id, method, amount)
                                                        }}
                                                    >
                                                        Pagar
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center text-green-600 gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                    <CheckCircle className="h-5 w-5" />
                                                    <span className="text-sm font-medium">Pagada</span>
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

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-orange-600" />
                    Próximas Cuotas
                    <Badge variant="secondary" className="ml-2">{installments.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {installments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No hay cuotas pendientes</p>
                    </div>
                ) : (
                    <div>
                        {renderInstallmentGroup('🚨 Vencidas', groupedInstallments.overdue, 'overdue')}
                        {renderInstallmentGroup('⏰ Vencen Hoy', groupedInstallments.today, 'today')}
                        {renderInstallmentGroup('📅 Esta Semana', groupedInstallments.thisWeek, 'thisWeek')}
                        {renderInstallmentGroup('📆 Próximamente', groupedInstallments.later, 'later')}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
