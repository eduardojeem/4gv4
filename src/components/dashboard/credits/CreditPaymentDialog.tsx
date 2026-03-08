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
import { CreditCard, User, DollarSign, FileText, Calendar, AlertCircle, CheckCircle2, Printer } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatCustomerId, formatCreditId } from '@/lib/utils'

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type PaymentConfirmResult =
    | { success: true; appliedAmount?: number }
    | { success: false; error: string }

interface CreditPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (method: PaymentMethod, amount: number, reference?: string, notes?: string) => Promise<PaymentConfirmResult>
    initialAmount?: number
    creditInfo?: {
        id: string
        customerName: string
        customerId: string
        customerCode?: string
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
    const [submitting, setSubmitting] = useState(false)
    const [paymentDone, setPaymentDone] = useState<{ method: PaymentMethod; amount: number; reference?: string; notes?: string; date: Date } | null>(null)

    useEffect(() => {
        if (open && initialAmount !== undefined) {
            setAmount(String(initialAmount))
            setError('')
            setReference('')
            setNotes('')
            setSubmitting(false)
            setPaymentDone(null)
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
    const handleConfirm = async () => {
        const numericAmount = parseFloat(amount)
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Ingrese un monto válido')
            return
        }
        if (creditInfo && numericAmount > creditInfo.remainingBalance) {
            setError('El monto excede el saldo pendiente')
            return
        }

        setError('')
        setSubmitting(true)
        try {
            const result = await onConfirm(method, numericAmount, reference || undefined, notes || undefined)
            if (result.success === false) {
                setError(result.error || 'No se pudo registrar el pago.')
                return
            }

            const paid = {
                method,
                amount: typeof result.appliedAmount === 'number' ? result.appliedAmount : numericAmount,
                reference: reference || undefined,
                notes: notes || undefined,
                date: new Date()
            }
            setPaymentDone(paid)
            // No cerramos el dialog aquí; mostramos pantalla de éxito
        } catch {
            setError('No se pudo registrar el pago.')
        } finally {
            setSubmitting(false)
        }
    }

    const getMethodLabel = (m: PaymentMethod) => {
        switch (m) {
            case 'cash': return 'Efectivo'
            case 'card': return 'Tarjeta'
            case 'transfer': return 'Transferencia'
        }
    }

    const isValid = amount && !error && parseFloat(amount) > 0

    const generateReceiptDoc = async () => {
        if (!paymentDone) return null
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
        const pageW = doc.internal.pageSize.getWidth()
        const receiptNum = `REC-${Date.now().toString(36).toUpperCase()}`

        // --- Encabezado ---
        doc.setFillColor(37, 99, 235)
        doc.rect(0, 0, pageW, 28, 'F')
        doc.setTextColor(255)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('COMPROBANTE DE PAGO', pageW / 2, 12, { align: 'center' })
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(`N° ${receiptNum}`, pageW / 2, 20, { align: 'center' })
        doc.setTextColor(0)

        // --- Fecha ---
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`Emitido: ${paymentDone.date.toLocaleString('es-AR')}`, pageW / 2, 35, { align: 'center' })
        doc.setTextColor(0)

        // --- Datos del crédito ---
        if (creditInfo) {
            autoTable(doc, {
                startY: 40,
                head: [['Datos del Crédito', '']],
                body: [
                    ['Cliente', creditInfo.customerName],
                    ['ID Cliente', creditInfo.customerCode || formatCustomerId(creditInfo.customerId)],
                    ['ID Crédito', formatCreditId(creditInfo.id)],
                    ...( creditInfo.nextInstallmentNumber ? [['N° de Cuota', `#${creditInfo.nextInstallmentNumber}`]] : []),
                    ...( creditInfo.nextDueDate ? [['Vencimiento', new Date(creditInfo.nextDueDate).toLocaleDateString('es-AR')]] : []),
                ],
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 10 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
                margin: { left: 10, right: 10 },
            })
        }

        // --- Detalle del pago ---
        const afterCredit = (doc as any).lastAutoTable?.finalY ?? 40
        autoTable(doc, {
            startY: afterCredit + 6,
            head: [['Detalle del Pago', '']],
            body: [
                ['Monto Pagado', formatCurrency(paymentDone.amount)],
                ['Método', getMethodLabel(paymentDone.method)],
                ...( paymentDone.reference ? [['Referencia', paymentDone.reference]] : []),
                ...( paymentDone.notes ? [['Notas', paymentDone.notes]] : []),
            ],
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
            bodyStyles: { fontSize: 10 },
            margin: { left: 10, right: 10 },
        })

        // --- Nuevo saldo ---
        if (creditInfo) {
            const afterPayment = (doc as any).lastAutoTable.finalY + 4
            const newBalance = creditInfo.remainingBalance - paymentDone.amount
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text(`Nuevo saldo pendiente: ${formatCurrency(Math.max(0, newBalance))}`, pageW / 2, afterPayment + 6, { align: 'center' })
        }

        // --- Footer ---
        const pageH = doc.internal.pageSize.getHeight()
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(150)
        doc.text('Este comprobante es válido como constancia de pago.', pageW / 2, pageH - 8, { align: 'center' })

        return { doc, receiptNum }
    }

    const downloadReceipt = async () => {
        const result = await generateReceiptDoc()
        if (result) {
            result.doc.save(`comprobante_${result.receiptNum}.pdf`)
        }
    }

    const printReceipt = async () => {
        const result = await generateReceiptDoc()
        if (result) {
            result.doc.autoPrint()
            // En navegadores modernos esto abre una ventana nueva con el PDF listo para imprimir
            result.doc.output('dataurlnewwindow')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {paymentDone
                            ? <><CheckCircle2 className="h-5 w-5 text-green-600" /> Pago Registrado</>
                            : <><DollarSign className="h-5 w-5 text-green-600" /> Registrar Pago</>
                        }
                    </DialogTitle>
                    <DialogDescription>
                        {paymentDone
                            ? 'El pago fue registrado correctamente. Podés descargar el comprobante.'
                            : 'Complete los detalles del pago a continuación'
                        }
                    </DialogDescription>
                </DialogHeader>

                {/* ===== PANTALLA DE ÉXITO ===== */}
                {paymentDone ? (
                    <>
                        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                            {/* Confirmación visual */}
                            <div className="flex flex-col items-center gap-3 py-4">
                                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="h-9 w-9 text-green-600" />
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        {formatCurrency(paymentDone.amount)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {getMethodLabel(paymentDone.method)}
                                        {paymentDone.reference && ` • Ref: ${paymentDone.reference}`}
                                    </p>
                                </div>
                            </div>

                            {/* Resumen */}
                            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-2">
                                {creditInfo && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Cliente</span>
                                            <span className="font-medium">{creditInfo.customerName}</span>
                                        </div>
                                        {creditInfo.nextInstallmentNumber && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Cuota</span>
                                                <span className="font-medium">#{creditInfo.nextInstallmentNumber}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Nuevo saldo</span>
                                            <span className="font-semibold text-orange-600">
                                                {formatCurrency(Math.max(0, creditInfo.remainingBalance - paymentDone.amount))}
                                            </span>
                                        </div>
                                    </>
                                )}
                                {paymentDone.notes && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Notas</span>
                                        <span className="font-medium text-right max-w-[60%]">{paymentDone.notes}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs pt-1 border-t border-green-200 dark:border-green-800">
                                    <span className="text-muted-foreground">Fecha</span>
                                    <span>{paymentDone.date.toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer éxito */}
                        <div className="px-6 pb-6 pt-4 border-t border-border shrink-0 grid grid-cols-2 lg:grid-cols-3 gap-3">
                            <Button
                                variant="outline"
                                className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                                onClick={printReceipt}
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                            </Button>
                            <Button
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                                onClick={downloadReceipt}
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Descargar
                            </Button>
                            <Button className="col-span-2 lg:col-span-1" onClick={() => { onOpenChange(false) }}>
                                Cerrar
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="overflow-y-auto flex-1 px-6 space-y-4">
                            {/* Credit & Customer Info */}

                            {creditInfo && (
                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-blue-600" />
                                                <div>
                                                    <p className="font-semibold text-sm">{creditInfo.customerName}</p>
                                                    <p className="text-xs text-muted-foreground">{creditInfo.customerCode || formatCustomerId(creditInfo.customerId)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            <CreditCard className="h-3 w-3 mr-1" />
                                            {formatCreditId(creditInfo.id)}
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
                                                        {creditInfo.nextDueDate ? new Date(creditInfo.nextDueDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
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
                                                <SelectItem value="cash"><div className="flex items-center gap-2"><span>💵</span><span>Efectivo</span></div></SelectItem>
                                                <SelectItem value="card"><div className="flex items-center gap-2"><span>💳</span><span>Tarjeta</span></div></SelectItem>
                                                <SelectItem value="transfer"><div className="flex items-center gap-2"><span>🏦</span><span>Transferencia</span></div></SelectItem>
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
                                    <Input id="reference" className="font-mono" value={reference} placeholder="Ej: #TRX-12345" onChange={(e) => setReference(e.target.value)} maxLength={50} />
                                    <p className="text-xs text-muted-foreground">Número de transacción, comprobante o referencia del pago</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes" className="text-sm font-medium">
                                        Notas
                                        <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                                    </Label>
                                    <Textarea id="notes" className="resize-none h-20" value={notes} placeholder="Observaciones adicionales..." onChange={(e) => setNotes(e.target.value)} maxLength={500} />
                                </div>
                            </div>

                            {/* Payment Summary preview */}
                            {isValid && (
                                <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-green-800 dark:text-green-200 font-medium">Resumen del Pago</p>
                                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                                {getMethodLabel(method)}{reference && ` • Ref: ${reference}`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(parseFloat(amount))}</p>
                                            {creditInfo && (
                                                <p className="text-xs text-green-600 dark:text-green-400">
                                                    Nuevo saldo: {formatCurrency(creditInfo.remainingBalance - parseFloat(amount))}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer fijo - formulario */}
                        <div className="px-6 pb-6 pt-4 border-t border-border shrink-0 flex items-center justify-end gap-3">
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
                            <Button onClick={handleConfirm} disabled={!isValid || submitting} className="bg-green-600 hover:bg-green-700">
                                <DollarSign className="h-4 w-4 mr-2" />
                                {submitting ? 'Guardando...' : 'Confirmar Pago'}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}


