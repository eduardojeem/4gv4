'use client'

import { Printer, Download, Mail, Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CartItem } from '@/hooks/usePOS'
import { formatCurrency } from '@/lib/currency'
import { 
    formatInvoiceHTML, 
    formatReceiptText, 
    formatReceiptForPrinter,
    formatThermalReceipt,
    formatReceiptWithQR,
    formatReceiptLargeText,
    formatThermalReceiptXL,
    InvoiceData 
} from '@/lib/invoice-generator'

interface ReceiptViewerProps {
    saleNumber: string
    items: CartItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    paymentMethod: string
    amountPaid: number
    change: number
    customerName?: string
    onPrint?: () => void
    onDownload?: () => void
    onEmail?: () => void
    onNewSale?: () => void
}

export function ReceiptViewer({
    saleNumber,
    items,
    subtotal,
    tax,
    discount,
    total,
    paymentMethod,
    amountPaid,
    change,
    customerName,
    onPrint,
    onDownload,
    onEmail,
    onNewSale
}: ReceiptViewerProps) {

    const handlePrint = () => {
        const invoiceData: InvoiceData = {
            invoiceNumber: saleNumber,
            date: new Date().toISOString(),
            sellerName: 'Mi Empresa',
            sellerAddress: 'Dirección de la empresa',
            sellerTaxId: '80012345-6',
            customerName: customerName || 'Cliente General',
            items: items.map(item => ({
                description: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                discount: item.discount,
                subtotal: item.subtotal
            })),
            subtotal,
            discount,
            tax,
            total,
            paymentMethod,
            amountPaid,
            change
        }

        const html = formatInvoiceHTML(invoiceData)
        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(html)
            printWindow.document.close()
            printWindow.print()
        }

        onPrint?.()
    }

    const handleDownload = () => {
        // TODO: Implement PDF download
        onDownload?.()
    }

    const handleEmail = () => {
        // TODO: Implement email send
        onEmail?.()
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
                <div className="flex items-center justify-center gap-2">
                    <Check className="h-8 w-8" />
                    <CardTitle className="text-2xl">¡Venta Completada!</CardTitle>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-6 space-y-6">
                {/* Receipt Preview */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-4">
                    {/* Header */}
                    <div className="text-center border-b pb-4">
                        <h3 className="text-xl font-bold">Mi Empresa</h3>
                        <p className="text-sm text-gray-600">Dirección de la empresa</p>
                        <p className="text-sm text-gray-600">RUC: 80012345-6</p>
                    </div>

                    {/* Sale Info */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">N° de Venta:</span>
                            <span className="font-mono font-bold">{saleNumber}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Fecha:</span>
                            <span>{new Date().toLocaleString('es')}</span>
                        </div>
                        {customerName && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Cliente:</span>
                                <span>{customerName}</span>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Items */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Productos:</h4>
                        {items.map((item) => (
                            <div key={item.id} className="text-sm">
                                <div className="flex justify-between font-medium">
                                    <span>{item.name}</span>
                                    <span>{formatCurrency(item.subtotal)}</span>
                                </div>
                                <div className="text-gray-600 text-xs">
                                    {item.quantity} x {formatCurrency(item.price)}
                                </div>
                                {item.discount > 0 && (
                                    <div className="text-green-600 text-xs">
                                        Descuento: -{formatCurrency(item.discount)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>

                        {discount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Descuento:</span>
                                <span>-{formatCurrency(discount)}</span>
                            </div>
                        )}

                        {tax > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">IVA:</span>
                                <span>{formatCurrency(tax)}</span>
                            </div>
                        )}

                        <Separator />

                        <div className="flex justify-between text-lg font-bold">
                            <span>TOTAL:</span>
                            <span className="text-blue-600">{formatCurrency(total)}</span>
                        </div>

                        <Separator />

                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Método de Pago:</span>
                                <span className="font-medium">{paymentMethod}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Pagado:</span>
                                <span>{formatCurrency(amountPaid)}</span>
                            </div>
                            {change > 0 && (
                                <div className="flex justify-between text-green-600 font-medium">
                                    <span>Cambio:</span>
                                    <span>{formatCurrency(change)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div className="text-center text-sm text-gray-600">
                        <p>¡Gracias por su compra!</p>
                        <p className="text-xs mt-2">{new Date().toLocaleString('es')}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                    {/* Sección: Impresión Estándar */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Impresión Estándar</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={handlePrint}
                                variant="outline"
                                className="w-full"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                HTML
                            </Button>

                            <Button
                                onClick={() => {
                                    const invoiceData: InvoiceData = {
                                        invoiceNumber: saleNumber,
                                        date: new Date().toISOString(),
                                        sellerName: 'Mi Empresa',
                                        sellerAddress: 'Dirección de la empresa',
                                        sellerTaxId: '80012345-6',
                                        sellerPhone: '123-456-7890',
                                        sellerEmail: 'info@miempresa.com',
                                        customerName: customerName || 'Cliente General',
                                        items: items.map(item => ({
                                            description: item.name,
                                            quantity: item.quantity,
                                            unitPrice: item.price,
                                            discount: item.discount,
                                            subtotal: item.subtotal
                                        })),
                                        subtotal,
                                        discount,
                                        tax,
                                        total,
                                        paymentMethod,
                                        amountPaid,
                                        change
                                    }

                                    const thermalReceipt = formatReceiptForPrinter(invoiceData, '48mm')
                                    const printWindow = window.open('', '_blank')
                                    if (printWindow) {
                                        printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${thermalReceipt}</pre>`)
                                        printWindow.document.close()
                                        printWindow.print()
                                    }
                                }}
                                variant="outline"
                                className="w-full bg-blue-50 hover:bg-blue-100"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                48mm
                            </Button>
                        </div>
                    </div>

                    {/* Sección: Texto Grande */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Texto Grande (Mayor Visibilidad)</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={() => {
                                    const invoiceData: InvoiceData = {
                                        invoiceNumber: saleNumber,
                                        date: new Date().toISOString(),
                                        sellerName: 'Mi Empresa',
                                        sellerAddress: 'Dirección de la empresa',
                                        sellerTaxId: '80012345-6',
                                        sellerPhone: '123-456-7890',
                                        sellerEmail: 'info@miempresa.com',
                                        customerName: customerName || 'Cliente General',
                                        items: items.map(item => ({
                                            description: item.name,
                                            quantity: item.quantity,
                                            unitPrice: item.price,
                                            discount: item.discount,
                                            subtotal: item.subtotal
                                        })),
                                        subtotal,
                                        discount,
                                        tax,
                                        total,
                                        paymentMethod,
                                        amountPaid,
                                        change
                                    }

                                    const largeTextReceipt = formatReceiptLargeText(invoiceData)
                                    const printWindow = window.open('', '_blank')
                                    if (printWindow) {
                                        printWindow.document.write(`<pre style="font-family: monospace; font-size: 14px; font-weight: 600; white-space: pre-wrap; line-height: 1.4;">${largeTextReceipt}</pre>`)
                                        printWindow.document.close()
                                        printWindow.print()
                                    }
                                }}
                                variant="outline"
                                className="w-full bg-purple-50 hover:bg-purple-100 border-purple-200"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Texto XL
                            </Button>

                            <Button
                                onClick={() => {
                                    const invoiceData: InvoiceData = {
                                        invoiceNumber: saleNumber,
                                        date: new Date().toISOString(),
                                        sellerName: 'Mi Empresa',
                                        sellerAddress: 'Dirección de la empresa',
                                        sellerTaxId: '80012345-6',
                                        sellerPhone: '123-456-7890',
                                        sellerEmail: 'info@miempresa.com',
                                        customerName: customerName || 'Cliente General',
                                        items: items.map(item => ({
                                            description: item.name,
                                            quantity: item.quantity,
                                            unitPrice: item.price,
                                            discount: item.discount,
                                            subtotal: item.subtotal
                                        })),
                                        subtotal,
                                        discount,
                                        tax,
                                        total,
                                        paymentMethod,
                                        amountPaid,
                                        change
                                    }

                                    const thermalXL = formatThermalReceiptXL(invoiceData)
                                    const printWindow = window.open('', '_blank')
                                    if (printWindow) {
                                        printWindow.document.write(`<pre style="font-family: monospace; font-size: 14px; font-weight: 600; white-space: pre-wrap; line-height: 1.4;">${thermalXL}</pre>`)
                                        printWindow.document.close()
                                        printWindow.print()
                                    }
                                }}
                                variant="outline"
                                className="w-full bg-orange-50 hover:bg-orange-100 border-orange-200"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Térmico XL
                            </Button>
                        </div>
                    </div>

                    {/* Sección: Opciones Especiales */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Opciones Especiales</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={() => {
                                    const invoiceData: InvoiceData = {
                                        invoiceNumber: saleNumber,
                                        date: new Date().toISOString(),
                                        sellerName: 'Mi Empresa',
                                        sellerAddress: 'Dirección de la empresa',
                                        sellerTaxId: '80012345-6',
                                        sellerPhone: '123-456-7890',
                                        sellerEmail: 'info@miempresa.com',
                                        customerName: customerName || 'Cliente General',
                                        items: items.map(item => ({
                                            description: item.name,
                                            quantity: item.quantity,
                                            unitPrice: item.price,
                                            discount: item.discount,
                                            subtotal: item.subtotal
                                        })),
                                        subtotal,
                                        discount,
                                        tax,
                                        total,
                                        paymentMethod,
                                        amountPaid,
                                        change
                                    }

                                    const receiptWithQR = formatReceiptWithQR(invoiceData)
                                    const printWindow = window.open('', '_blank')
                                    if (printWindow) {
                                        printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${receiptWithQR}</pre>`)
                                        printWindow.document.close()
                                        printWindow.print()
                                    }
                                }}
                                variant="outline"
                                className="w-full bg-green-50 hover:bg-green-100 border-green-200"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                + QR
                            </Button>

                            <Button
                                onClick={handleDownload}
                                variant="outline"
                                className="w-full"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                PDF
                            </Button>

                            <Button
                                onClick={handleEmail}
                                variant="outline"
                                className="w-full"
                            >
                                <Mail className="h-4 w-4 mr-2" />
                                Email
                            </Button>

                            <Button
                                onClick={() => navigator.share?.({
                                    title: 'Recibo', text: formatReceiptForPrinter({
                                        invoiceNumber: saleNumber,
                                        date: new Date().toISOString(),
                                        sellerName: 'Mi Empresa',
                                        sellerAddress: 'Dirección de la empresa',
                                        sellerTaxId: '80012345-6',
                                        items: items.map(i => ({
                                            description: i.name,
                                            quantity: i.quantity,
                                            unitPrice: i.price,
                                            discount: i.discount,
                                            subtotal: i.subtotal
                                        })),
                                        subtotal,
                                        discount,
                                        tax,
                                        total,
                                        paymentMethod,
                                        amountPaid,
                                        change
                                    }, '48mm')
                                })}
                                variant="outline"
                                className="w-full"
                            >
                                <Share2 className="h-4 w-4 mr-2" />
                                Compartir
                            </Button>
                        </div>
                    </div>
                </div>

                {/* New Sale Button */}
                <Button
                    onClick={onNewSale}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    size="lg"
                >
                    Nueva Venta
                </Button>
            </CardContent>
        </Card>
    )
}
