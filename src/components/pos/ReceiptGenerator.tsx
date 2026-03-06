'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, Download, Share2, CheckCircle2 } from 'lucide-react'
import { getTaxConfig, config } from '@/lib/config'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import QRCode from 'qrcode'

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  discount?: number
  isService?: boolean
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
  cashRegister?: string
  shift?: string
  customer?: {
    name: string
    phone: string
    email: string
  }
  items: CartItem[]
  subtotal: number
  totalDiscount: number
  tax: number
  repairCost?: number
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
  const { settings } = useSharedSettings()
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  
  const companyInfo = {
    name: settings.companyName || config.company.name,
    address: settings.companyAddress || config.company.address,
    phone: settings.companyPhone || config.company.phone,
    email: settings.companyEmail || config.company.email,
    ruc: settings.companyRuc,
    website: 'www.4gcelulares.com'
  }

  // Generar código QR
  useEffect(() => {
    const generateQR = async () => {
      try {
        const verifyUrl = `${companyInfo.website}/verify/${receiptData.receiptNumber}`
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          width: 120,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        setQrCodeUrl(qrDataUrl)
      } catch (error) {
        console.error('Error generating QR code:', error)
      }
    }
    generateQR()
  }, [receiptData.receiptNumber, companyInfo.website])

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: '💵 Efectivo',
      card: '💳 Tarjeta',
      transfer: '🏦 Transferencia',
      credit: '📝 Crédito'
    }
    return labels[method as keyof typeof labels] || method
  }

  const getPaymentIcon = (method: string) => {
    const icons = {
      cash: '💵',
      card: '💳',
      transfer: '🏦',
      credit: '📝'
    }
    return icons[method as keyof typeof icons] || '💰'
  }

  return (
    <div id="receipt-content" className="max-w-md mx-auto bg-card text-foreground rounded-lg shadow-lg border border-border">
      {/* Encabezado mejorado con logo */}
      <div className="text-center border-b-2 border-dashed border-border pb-4 mb-4 bg-gradient-to-b from-primary/5 to-transparent pt-4">
        {/* Logo placeholder - reemplazar con imagen real */}
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-2xl">
            4G
          </div>
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-tight">{companyInfo.name}</h1>
        <p className="text-sm font-medium text-primary">Reparación y Service</p>
        {companyInfo.ruc && (
          <p className="text-xs text-muted-foreground mt-1">RUC: {companyInfo.ruc}</p>
        )}
        <p className="text-xs text-muted-foreground">{companyInfo.address}</p>
        <p className="text-xs text-muted-foreground">☎ {companyInfo.phone}</p>
        <p className="text-xs text-muted-foreground">📧 {companyInfo.email}</p>
      </div>

      {/* Número de ticket destacado */}
      <div className="bg-primary/10 border-l-4 border-primary px-4 py-3 mb-4 rounded-r">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Ticket N°</span>
          <span className="text-lg font-bold font-mono text-primary">{receiptData.receiptNumber}</span>
        </div>
      </div>

      {/* Información de la venta mejorada */}
      <div className="mb-4 text-sm space-y-1 px-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">📅 Fecha:</span>
          <span className="font-medium">{receiptData.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">⏰ Hora:</span>
          <span className="font-medium">{receiptData.time}</span>
        </div>
        {receiptData.cashRegister && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">🏪 Caja:</span>
            <span className="font-medium">{receiptData.cashRegister}</span>
          </div>
        )}
        {receiptData.shift && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">🕐 Turno:</span>
            <span className="font-medium">{receiptData.shift}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">👤 Cajero:</span>
          <span className="font-medium">{receiptData.cashier}</span>
        </div>
        {receiptData.customer && (
          <>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">👥 Cliente:</span>
              <span className="font-medium">{receiptData.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">📱 Teléfono:</span>
              <span className="font-medium">{receiptData.customer.phone}</span>
            </div>
          </>
        )}
      </div>

      <Separator className="my-4" />

      {/* Detalle de productos mejorado */}
      <div className="mb-4 px-4">
        <h3 className="font-bold text-sm mb-3 text-center bg-muted/50 py-2 rounded">
          DETALLE DE PRODUCTOS
        </h3>
        {receiptData.items.map((item, index) => (
          <div key={item.id} className="mb-3 pb-3 border-b border-dashed border-border/50 last:border-0">
            <div className="flex justify-between items-start font-medium mb-1">
              <span className="flex-1 leading-tight">
                {item.name}
                {item.isService && (
                  <span className="ml-2 inline-block text-[10px] font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                    🔧 SERVICIO
                  </span>
                )}
              </span>
              <span className="ml-3 font-bold whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>SKU: {item.sku}</span>
              <span>{item.quantity} × {formatCurrency(item.price)}</span>
            </div>
            {item.discount && item.discount > 0 && (
              <div className="flex justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                <span>✨ Descuento:</span>
                <span>-{formatCurrency(item.discount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Resumen de totales mejorado */}
      <div className="mb-4 text-sm px-4 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-medium">{formatCurrency(receiptData.subtotal)}</span>
        </div>
        {receiptData.totalDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
            <span>✨ Descuento Total:</span>
            <span>-{formatCurrency(receiptData.totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{getTaxConfig().label} ({getTaxConfig().percentage}%):</span>
          <span className="font-medium">{formatCurrency(receiptData.tax)}</span>
        </div>
        <Separator className="my-3" />
        <div className="flex justify-between items-center bg-primary/10 dark:bg-primary/20 px-3 py-2 rounded-lg">
          <span className="font-bold text-lg">TOTAL:</span>
          <span className="font-bold text-2xl text-primary">{formatCurrency(receiptData.total)}</span>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Métodos de pago mejorados */}
      <div className="mb-4 text-sm px-4">
        <h3 className="font-bold mb-3 text-center bg-muted/50 py-2 rounded">FORMA DE PAGO</h3>
        <div className="space-y-2">
          {receiptData.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded">
              <span className="flex items-center gap-2">
                <span>{getPaymentIcon(payment.method)}</span>
                <span>
                  {getPaymentMethodLabel(payment.method).replace(/^[^\s]+\s/, '')}
                  {payment.reference && ` (${payment.reference})`}
                  {payment.cardLast4 && ` ****${payment.cardLast4}`}
                </span>
              </span>
              <span className="font-bold">{formatCurrency(payment.amount)}</span>
            </div>
          ))}
          {receiptData.change && receiptData.change > 0 && (
            <div className="flex justify-between items-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded mt-2">
              <span className="flex items-center gap-2">
                <span>💰</span>
                <span>Cambio:</span>
              </span>
              <span>{formatCurrency(receiptData.change)}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-bold mt-3 bg-green-50 dark:bg-green-900/20 py-2 rounded">
            <CheckCircle2 className="h-5 w-5" />
            <span>PAGADO</span>
          </div>
        </div>
      </div>

      {/* Puntos de lealtad */}
      {receiptData.loyaltyPoints && receiptData.loyaltyPoints > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-4 text-sm text-center px-4">
            <div className="rounded-lg p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800">
              <span className="font-bold text-amber-700 dark:text-amber-400 text-base">
                🎉 ¡Ganaste {receiptData.loyaltyPoints} puntos de lealtad! 🎉
              </span>
            </div>
          </div>
        </>
      )}

      <Separator className="my-4" />

      {/* Información de garantía */}
      <div className="mb-4 px-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">
            🛡️ GARANTÍA: 30 días
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300">
            Válido para cambios y reparaciones
          </p>
        </div>
      </div>

      {/* Código QR de verificación */}
      {qrCodeUrl && (
        <>
          <Separator className="my-4 print:hidden" />
          <div className="mb-4 text-center px-4 print:hidden">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Verificar ticket en línea:
            </p>
            <div className="flex justify-center mb-2">
              <img src={qrCodeUrl} alt="QR Code" className="w-28 h-28 border-2 border-border rounded" />
            </div>
            <p className="text-xs text-primary font-medium">
              {companyInfo.website}/verify
            </p>
          </div>
        </>
      )}

      <Separator className="my-4" />

      {/* Pie del ticket mejorado */}
      <div className="text-center text-xs text-muted-foreground mb-4 px-4 space-y-1">
        <p className="font-bold text-sm text-foreground">¡Gracias por su compra!</p>
        <p>Conserve este ticket como comprobante</p>
        <p>📱 Consultas: {companyInfo.phone}</p>
        <p>📧 {companyInfo.email}</p>
        <Separator className="my-2" />
        <p className="font-mono text-[10px]">
          ID: {receiptData.receiptNumber}
        </p>
        <p className="font-mono text-[10px]">
          Generado: {new Date().toLocaleString('es-PY')}
        </p>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2 mt-6 px-4 pb-4 print:hidden">
        <Button onClick={onPrint} className="flex-1" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <Button onClick={onDownload} variant="outline" className="flex-1" size="sm">
          <Download className="h-4 w-4 mr-2" />
          PDF
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
