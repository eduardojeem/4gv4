'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Printer, Download, Share2 } from 'lucide-react'
import { getTaxConfig } from '@/lib/config'

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  discount?: number
}

interface PaymentSplit {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: number
  reference?: string
  cardLast4?: string
}

interface ReceiptData {
  receiptNumber: string
  date: string
  time: string
  cashier: string
  customer?: {
    name: string
    phone: string
    email: string
  }
  items: CartItem[]
  subtotal: number
  totalDiscount: number
  tax: number
  total: number
  payments: PaymentSplit[]
  change?: number
  loyaltyPoints?: number
}

interface ReceiptGeneratorProps {
  receiptData: ReceiptData
  onPrint: () => void
  onDownload: () => void
  onShare: () => void
  formatCurrency: (amount: number) => string
}

export const ReceiptGenerator: React.FC<ReceiptGeneratorProps> = ({
  receiptData,
  onPrint,
  onDownload,
  onShare,
  formatCurrency
}) => {
  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito'
    }
    return labels[method as keyof typeof labels] || method
  }

  return (
    <div className="max-w-md mx-auto bg-card text-foreground rounded-lg shadow-sm">
      {/* Encabezado del ticket */}
      <div className="text-center border-b-2 border-dashed border-border pb-4 mb-4">
        <h1 className="text-xl font-bold">COMERCIAL 4G</h1>
        <p className="text-sm text-muted-foreground">Sistema de Punto de Venta</p>
        <p className="text-xs text-muted-foreground">RUC: 80.123.456-7</p>
        <p className="text-xs text-muted-foreground">Dirección: Av. Principal 123, Asunción</p>
        <p className="text-xs text-muted-foreground">Tel: +595-21-123456</p>
      </div>

      {/* Información de la venta */}
      <div className="mb-4 text-sm">
        <div className="flex justify-between">
          <span>Ticket N°:</span>
          <span className="font-mono">{receiptData.receiptNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Fecha:</span>
          <span>{receiptData.date}</span>
        </div>
        <div className="flex justify-between">
          <span>Hora:</span>
          <span>{receiptData.time}</span>
        </div>
        <div className="flex justify-between">
          <span>Cajero:</span>
          <span>{receiptData.cashier}</span>
        </div>
        {receiptData.customer && (
          <>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>Cliente:</span>
              <span>{receiptData.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Teléfono:</span>
              <span>{receiptData.customer.phone}</span>
            </div>
          </>
        )}
      </div>

      <Separator className="my-4" />

      {/* Detalle de productos */}
      <div className="mb-4">
        <h3 className="font-semibold text-sm mb-2">DETALLE DE PRODUCTOS</h3>
        {receiptData.items.map((item, index) => (
          <div key={item.id} className="mb-3 text-xs">
            <div className="flex justify-between font-medium">
              <span className="flex-1">{item.name}</span>
              <span className="ml-2">{formatCurrency(item.price * item.quantity)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SKU: {item.sku}</span>
              <span>{item.quantity} x {formatCurrency(item.price)}</span>
            </div>
            {item.discount && item.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Descuento:</span>
                <span>-{formatCurrency(item.discount)}</span>
              </div>
            )}
            {index < receiptData.items.length - 1 && (
              <div className="border-b border-dotted border-border/60 dark:border-border/40 mt-2"></div>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Resumen de totales */}
      <div className="mb-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(receiptData.subtotal)}</span>
        </div>
        {receiptData.totalDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Descuento Total:</span>
            <span>-{formatCurrency(receiptData.totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
        <span className="text-muted-foreground">{getTaxConfig().label} ({getTaxConfig().percentage}%):</span>
          <span>{formatCurrency(receiptData.tax)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between font-bold text-lg">
          <span>TOTAL:</span>
          <span>{formatCurrency(receiptData.total)}</span>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Métodos de pago */}
      <div className="mb-4 text-sm">
        <h3 className="font-semibold mb-2">FORMA DE PAGO</h3>
        {receiptData.payments.map((payment, index) => (
          <div key={payment.id} className="flex justify-between">
            <span>
              {getPaymentMethodLabel(payment.method)}
              {payment.reference && ` (${payment.reference})`}
              {payment.cardLast4 && ` ****${payment.cardLast4}`}
            </span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
        ))}
        {receiptData.change && receiptData.change > 0 && (
          <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400 mt-2">
            <span>Cambio:</span>
            <span>{formatCurrency(receiptData.change)}</span>
          </div>
        )}
      </div>

      {/* Puntos de lealtad */}
      {receiptData.loyaltyPoints && receiptData.loyaltyPoints > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-4 text-sm text-center">
            <div className="rounded p-2 bg-primary/10 dark:bg-primary/20">
              <span className="font-medium text-primary">
                🎉 Has ganado {receiptData.loyaltyPoints} puntos de lealtad
              </span>
            </div>
          </div>
        </>
      )}

      <Separator className="my-4" />

      {/* Pie del ticket */}
      <div className="text-center text-xs text-muted-foreground mb-4">
        <p>¡Gracias por su compra!</p>
        <p>Conserve este ticket como comprobante</p>
        <p>Para consultas: info@comercial4g.com</p>
        <p className="mt-2 font-mono">
          Generado: {new Date().toLocaleString()}
        </p>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 mt-6 print:hidden">
        <Button onClick={onPrint} className="flex-1" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <Button onClick={onDownload} variant="outline" className="flex-1" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Descargar
        </Button>
        <Button onClick={onShare} variant="outline" className="flex-1" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Compartir
        </Button>
      </div>
    </div>
  )
}

export default ReceiptGenerator