'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import {
    CreditCard,
    User,
    Calendar,
    DollarSign,
    Percent,
    TrendingUp,
    Clock,
    CheckCircle,
    Receipt,
    FileText,
    Download,
    X
} from 'lucide-react'

interface CreditDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    credit: {
        id: string
        customer_id: string
        customer_name: string
        principal: number
        interest_rate: number
        term_months: number
        start_date: string
        status: 'active' | 'completed' | 'defaulted' | 'cancelled'
    } | null
    installments: Array<{
        id: string
        installment_number: number
        due_date: string
        amount: number
        status: 'pending' | 'paid' | 'late'
        paid_at?: string | null
        amount_paid?: number | null
    }>
    payments: Array<{
        id: string
        amount: number
        payment_method?: string
        created_at?: string
    }>
    remainingBalance: number
    paidAmount: number
}

export function CreditDetailDialog({
    open,
    onOpenChange,
    credit,
    installments,
    payments,
    remainingBalance,
    paidAmount
}: CreditDetailDialogProps) {
    if (!credit) return null

    const totalAmount = paidAmount + remainingBalance
    const progressPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0

    const endDate = new Date(credit.start_date)
    endDate.setMonth(endDate.getMonth() + credit.term_months)

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            case 'defaulted': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }
    }

    const getInstallmentStatusColor = (installment: any) => {
        if (installment.status === 'paid') return 'text-green-600'
        if (installment.status === 'late') return 'text-red-600'
        if (new Date(installment.due_date) < new Date()) return 'text-orange-600'
        return 'text-blue-600'
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-2xl">
                                <CreditCard className="h-6 w-6 text-blue-600" />
                                Detalle del Crédito
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                Información completa del crédito #{credit.id}
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Credit Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Customer Info */}
                        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                                    <p className="font-semibold text-lg">{credit.customer_name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">ID: {credit.customer_id}</p>
                                </div>
                            </div>
                        </div>

                        {/* Credit Status */}
                        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                                    <FileText className="h-5 w-5 text-gray-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground mb-1">Estado</p>
                                    <Badge className={`${getStatusColor(credit.status)} font-semibold mt-1`}>
                                        {credit.status === 'active' ? 'Activo' :
                                            credit.status === 'completed' ? 'Completado' :
                                                credit.status === 'defaulted' ? 'Moroso' : 'Cancelado'}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-2">Crédito #{credit.id}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border border-green-200 dark:border-green-800">
                            <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Principal</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                                {formatCurrency(credit.principal)}
                            </p>
                        </div>

                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-200 dark:border-blue-800">
                            <Percent className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Tasa de Interés</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                {credit.interest_rate}%
                            </p>
                        </div>

                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border border-purple-200 dark:border-purple-800">
                            <Calendar className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Plazo</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
                                {credit.term_months} meses
                            </p>
                        </div>

                        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-200 dark:border-orange-800">
                            <TrendingUp className="h-5 w-5 text-orange-600 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Progreso</p>
                            <p className="text-lg font-bold text-orange-700 dark:text-orange-400">
                                {progressPct}%
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                        <div className="flex items-center justify-between mb-2 text-sm">
                            <span className="font-medium">Progreso del Crédito</span>
                            <span className="text-muted-foreground">{progressPct}%</span>
                        </div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>Pagado: {formatCurrency(paidAmount)}</span>
                            <span>Pendiente: {formatCurrency(remainingBalance)}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            <div>
                                <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                                <p className="font-semibold">
                                    {new Date(credit.start_date).toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <Clock className="h-5 w-5 text-orange-600" />
                            <div>
                                <p className="text-xs text-muted-foreground">Fecha de Finalización</p>
                                <p className="font-semibold">
                                    {endDate.toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Tabs for Installments and Payments */}
                    <Tabs defaultValue="installments" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="installments">
                                <Receipt className="h-4 w-4 mr-2" />
                                Cuotas ({installments.length})
                            </TabsTrigger>
                            <TabsTrigger value="payments">
                                <DollarSign className="h-4 w-4 mr-2" />
                                Pagos ({payments.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Installments Tab */}
                        <TabsContent value="installments" className="mt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">#</TableHead>
                                            <TableHead>Vencimiento</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="text-right">Pagado</TableHead>
                                            <TableHead className="text-center">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {installments.map((inst) => (
                                            <TableRow key={inst.id}>
                                                <TableCell className="font-medium">{inst.installment_number}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {new Date(inst.due_date).toLocaleDateString('es-AR')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(inst.amount)}
                                                </TableCell>
                                                <TableCell className="text-right text-green-600">
                                                    {formatCurrency(inst.amount_paid || 0)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className={`flex items-center justify-center gap-1 ${getInstallmentStatusColor(inst)}`}>
                                                        {inst.status === 'paid' ? (
                                                            <>
                                                                <CheckCircle className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Pagada</span>
                                                            </>
                                                        ) : inst.status === 'late' ? (
                                                            <>
                                                                <X className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Atrasada</span>
                                                            </>
                                                        ) : new Date(inst.due_date) < new Date() ? (
                                                            <>
                                                                <Clock className="h-3 w-3" />
                                                                <span className="text-xs font-medium">Vencida</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs font-medium">Pendiente</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        {/* Payments Tab */}
                        <TabsContent value="payments" className="mt-4">
                            {payments.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No hay pagos registrados</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Método</TableHead>
                                                <TableHead className="text-right">Monto</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payments.map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>
                                                        {payment.created_at
                                                            ? new Date(payment.created_at).toLocaleString('es-AR', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })
                                                            : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {payment.payment_method === 'cash' ? '💵 Efectivo' :
                                                                payment.payment_method === 'card' ? '💳 Tarjeta' :
                                                                    payment.payment_method === 'transfer' ? '🏦 Transferencia' :
                                                                        payment.payment_method || '-'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-green-600">
                                                        {formatCurrency(payment.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => alert('Función en desarrollo')}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar Detalle
                        </Button>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => onOpenChange(false)}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
