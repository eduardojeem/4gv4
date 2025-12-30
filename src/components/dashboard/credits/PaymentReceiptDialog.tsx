'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/currency'
import { Building, User, CreditCard, Calendar, DollarSign, FileText, CheckCircle, Download, Printer } from 'lucide-react'

interface PaymentReceipt {
    id: string
    date: string
    creditId: string
    creditInfo: {
        customerName: string
        customerId: string
        principal: number
    }
    installmentNumber?: number
    amount: number
    paymentMethod: string
    reference?: string
    notes?: string
    newBalance: number
}

interface PaymentReceiptDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    receipt: PaymentReceipt | null
}

export function PaymentReceiptDialog({
    open,
    onOpenChange,
    receipt
}: PaymentReceiptDialogProps) {
    if (!receipt) return null

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'cash': return 'Efectivo'
            case 'card': return 'Tarjeta de Crédito/Débito'
            case 'transfer': return 'Transferencia Bancaria'
            default: return method
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const handleDownload = () => {
        // In a real implementation, you would generate a PDF here
        alert('Función de descarga de PDF en desarrollo')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] print:shadow-none">
                <DialogHeader className="print:mb-4">
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        Comprobante de Pago
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 print:text-black">
                    {/* Header with success message */}
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 print:bg-green-50 print:border-green-200">
                        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                        <p className="text-lg font-semibold text-green-800 dark:text-green-200 print:text-green-800">
                            ¡Pago Registrado Exitosamente!
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1 print:text-green-700">
                            {new Date(receipt.date).toLocaleString('es-AR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>

                    {/* Receipt Number */}
                    <div className="text-center py-2 border-y border-gray-200 dark:border-gray-700 print:border-gray-300">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide print:text-gray-600">Comprobante Nº</p>
                        <p className="text-lg font-mono font-bold mt-1">{receipt.id}</p>
                    </div>

                    {/* Customer & Credit Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <User className="h-5 w-5 text-blue-600 mt-0.5 print:text-blue-600" />
                                <div>
                                    <p className="text-xs text-muted-foreground print:text-gray-600">Cliente</p>
                                    <p className="font-semibold">{receipt.creditInfo.customerName}</p>
                                    <p className="text-xs text-muted-foreground print:text-gray-600">ID: {receipt.creditInfo.customerId}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <CreditCard className="h-5 w-5 text-purple-600 mt-0.5 print:text-purple-600" />
                                <div>
                                    <p className="text-xs text-muted-foreground print:text-gray-600">Crédito</p>
                                    <p className="font-semibold">#{receipt.creditId}</p>
                                    {receipt.installmentNumber && (
                                        <p className="text-xs text-muted-foreground print:text-gray-600">
                                            Cuota #{receipt.installmentNumber}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="print:border-gray-300" />

                    {/* Payment Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600 print:text-green-600" />
                            Detalles del Pago
                        </h3>

                        <div className="grid gap-3 text-sm">
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg print:bg-gray-50">
                                <span className="text-muted-foreground print:text-gray-600">Método de Pago</span>
                                <span className="font-semibold">{getPaymentMethodLabel(receipt.paymentMethod)}</span>
                            </div>

                            {receipt.reference && (
                                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg print:bg-gray-50">
                                    <span className="text-muted-foreground print:text-gray-600">Referencia</span>
                                    <span className="font-mono font-semibold">{receipt.reference}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 print:bg-green-50 print:border-green-200">
                                <span className="font-semibold text-green-800 dark:text-green-200 print:text-green-800">Monto Pagado</span>
                                <span className="text-2xl font-bold text-green-700 dark:text-green-300 print:text-green-700">
                                    {formatCurrency(receipt.amount)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg print:bg-gray-50">
                                <span className="text-muted-foreground print:text-gray-600">Nuevo Saldo Pendiente</span>
                                <span className="font-semibold text-orange-600 dark:text-orange-400 print:text-orange-600">
                                    {formatCurrency(receipt.newBalance)}
                                </span>
                            </div>
                        </div>

                        {receipt.notes && (
                            <div className="mt-4">
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1 print:text-gray-600">
                                    <FileText className="h-3 w-3" />
                                    Observaciones
                                </p>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm print:bg-gray-50">
                                    {receipt.notes}
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator className="print:border-gray-300" />

                    {/* Footer */}
                    <div className="text-center text-xs text-muted-foreground space-y-1 print:text-gray-600">
                        <p>Este comprobante es válido como constancia de pago</p>
                        <p className="font-mono">{receipt.id}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 print:hidden">
                        <Button variant="outline" className="flex-1" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Descargar PDF
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
