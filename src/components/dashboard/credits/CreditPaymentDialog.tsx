import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/currency'
import { CreditCard, User, DollarSign, FileText, Calendar, AlertCircle } from 'lucide-react'

export type PaymentMethod = 'cash' | 'card' | 'transfer'

interface CreditPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (method: PaymentMethod, amount: number, reference?: string, notes?: string) => void
    initialAmount?: number
    creditInfo?: {
        id: string
        customerName: string
        customerId: string
        principal: number
        interestRate: number
        termMonths: number
        remainingBalance: number
        nextInstallmentNumber?: number
        nextDueDate?: string
    }
}

export function CreditPaymentDialog({
    open,
    onOpenChange,
    onConfirm,
    initialAmount,
    creditInfo,
}: CreditPaymentDialogProps) {
    const [method, setMethod] = useState<PaymentMethod>('cash')
    const [amount, setAmount] = useState<string>('')
    const [reference, setReference] = useState<string>('')
    const [notes, setNotes] = useState<string>('')
    const [error, setError] = useState<string>('')

    useEffect(() => {
        if (open && initialAmount !== undefined) {
            setAmount(String(initialAmount))
            setError('')
            setReference('')
            setNotes('')
        }
    }, [open, initialAmount])

    const handleAmountChange = (value: string) => {
        setAmount(value)
        const numericAmount = parseFloat(value)

        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('El monto debe ser mayor a 0')
        } else if (creditInfo && numericAmount > creditInfo.remainingBalance) {
            setError(`El monto excede el saldo pendiente (${formatCurrency(creditInfo.remainingBalance)})`)
        } else {
            setError('')
        }
    }

    const handleConfirm = () => {
        const numericAmount = parseFloat(amount)
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Ingrese un monto válido')
            return
        }

        if (creditInfo && numericAmount > creditInfo.remainingBalance) {
            setError(`El monto excede el saldo pendiente`)
            return
        }

        onConfirm(method, numericAmount, reference || undefined, notes || undefined)
        onOpenChange(false)

        // Reset form
        setMethod('cash')
        setAmount('')
        setReference('')
        setNotes('')
        setError('')
    }

    const getMethodLabel = (m: PaymentMethod) => {
        switch (m) {
            case 'cash': return 'Efectivo'
            case 'card': return 'Tarjeta'
            case 'transfer': return 'Transferencia'
        }
    }

    const isValid = amount && !error && parseFloat(amount) > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        Registrar Pago
                    </DialogTitle>
                    <DialogDescription>
                        Complete los detalles del pago a continuación
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Credit & Customer Info */}
                    {creditInfo && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-blue-600" />
                                        <div>
                                            <p className="font-semibold text-sm">{creditInfo.customerName}</p>
                                            <p className="text-xs text-muted-foreground">ID: {creditInfo.customerId}</p>
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    {creditInfo.id}
                                </Badge>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs">Principal</p>
                                    <p className="font-semibold">{formatCurrency(creditInfo.principal)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Saldo Pendiente</p>
                                    <p className="font-semibold text-orange-600">{formatCurrency(creditInfo.remainingBalance)}</p>
                                </div>
                                {creditInfo.nextInstallmentNumber && (
                                    <>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Próxima Cuota</p>
                                            <p className="font-semibold">#{creditInfo.nextInstallmentNumber}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Vencimiento</p>
                                            <p className="font-semibold">
                                                {creditInfo.nextDueDate ? new Date(creditInfo.nextDueDate).toLocaleDateString('es-AR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                }) : '-'}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Payment Details */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="method" className="text-sm font-medium">
                                    Método de Pago *
                                </Label>
                                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                                    <SelectTrigger id="method">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">
                                            <div className="flex items-center gap-2">
                                                <span>💵</span>
                                                <span>Efectivo</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="card">
                                            <div className="flex items-center gap-2">
                                                <span>💳</span>
                                                <span>Tarjeta</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="transfer">
                                            <div className="flex items-center gap-2">
                                                <span>🏦</span>
                                                <span>Transferencia</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-sm font-medium">
                                    Monto a Pagar *
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="amount"
                                        type="number"
                                        className={`pl-7 ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                        value={amount}
                                        placeholder="0.00"
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        step="0.01"
                                    />
                                </div>
                                {error && (
                                    <p className="text-xs text-red-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {error}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reference" className="text-sm font-medium">
                                Número de Referencia
                                <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                            </Label>
                            <Input
                                id="reference"
                                className="font-mono"
                                value={reference}
                                placeholder="Ej: #TRX-12345, Comp. 00123"
                                onChange={(e) => setReference(e.target.value)}
                                maxLength={50}
                            />
                            <p className="text-xs text-muted-foreground">
                                Número de transacción, comprobante o referencia del pago
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-sm font-medium">
                                Notas
                                <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                            </Label>
                            <Textarea
                                id="notes"
                                className="resize-none h-20"
                                value={notes}
                                placeholder="Observaciones adicionales sobre el pago..."
                                onChange={(e) => setNotes(e.target.value)}
                                maxLength={500}
                            />
                        </div>
                    </div>

                    {/* Payment Summary */}
                    {isValid && (
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                                        Resumen del Pago
                                    </p>
                                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                        {getMethodLabel(method)}
                                        {reference && ` • Ref: ${reference}`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                        {formatCurrency(parseFloat(amount))}
                                    </p>
                                    {creditInfo && (
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            Nuevo saldo: {formatCurrency(creditInfo.remainingBalance - parseFloat(amount))}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!isValid}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Confirmar Pago
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
