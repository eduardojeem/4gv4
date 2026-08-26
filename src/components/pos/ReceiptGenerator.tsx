'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, Download, Share2, CheckCircle2 } from 'lucide-react'
import { getTaxConfig, config } from '@/lib/config'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatPosCreditDueDate } from '@/lib/credits/pos-credit-summary'

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
  creditInfo?: {
    baseTotal: number
    interestAmount: number
    financedTotal: number
    installmentCount: number
    installmentAmount: number
    frequency: string
    interestRate: number
    firstDueDate: string
  }
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
  const componentRef = useRef<HTMLDivElement>(null)
  const { settings } = useSharedSettings()
  const { settings: websiteSettings } = useAdminWebsiteSettings()
  const logoUrl = websiteSettings?.company_info?.logoUrl
  
  const companyInfo = {
    name: settings.companyName && settings.companyName !== 'Mi Empresa' 
      ? settings.companyName 
      : config.company.name,
    address: settings.companyAddress || config.company.address,
    phone: settings.companyPhone || config.company.phone,
    email: settings.companyEmail && settings.companyEmail !== 'info@empresa.com'
      ? settings.companyEmail
      : config.company.email,
    ruc: settings.companyRuc || config.company.ruc,
    website: settings.companyName ? `www.${settings.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : 'www.miempresa.com',
    logoUrl: logoUrl
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito'
    }
    return labels[method as keyof typeof labels] || method
  }

  const getPaymentIcon = (method: string) => {
    return '' // Removed icons for better print compatibility
  }

  return (
    <div id="receipt-content" className="max-w-md mx-auto bg-card text-foreground rounded-lg shadow-lg border border-border print:max-w-full print:shadow-none print:border-none print:rounded-none print:mx-0 print:bg-transparent print:text-black">
      {/* Encabezado mejorado con logo */}
      <div className="text-center border-b-2 border-dashed border-border pb-4 mb-4 bg-gradient-to-b from-primary/5 to-transparent pt-4">
        {/* Initials placeholder */}
        <div className="flex justify-center mb-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-2xl">
              {companyInfo.name ? companyInfo.name.substring(0, 2).toUpperCase() : 'Mi'}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-tight">{companyInfo.name}</h1>
        <p className="text-sm font-medium text-primary">Reparación y Service</p>
        {companyInfo.ruc && (
          <p className="text-xs font-semibold text-muted-foreground mt-1">RUC: {companyInfo.ruc}</p>
        )}
        <p className="text-xs text-muted-foreground">{companyInfo.address}</p>
        <p className="text-xs text-muted-foreground">Tel: {companyInfo.phone}</p>
        <p className="text-xs text-muted-foreground">Email: {companyInfo.email}</p>
      </div>

      {/* Número de ticket destacado */}
      <div className="bg-primary/10 border-l-4 border-primary px-4 py-3 mb-4 rounded-r">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Ticket Nº</span>
          <span className="text-lg font-bold font-mono text-primary">{receiptData.receiptNumber}</span>
        </div>
      </div>

      {/* Información de la venta */}
      <div className="mb-4 text-sm space-y-1 px-4 print:px-0">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fecha:</span>
          <span className="font-medium">{receiptData.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Hora:</span>
          <span className="font-medium">{receiptData.time}</span>
        </div>
        {receiptData.cashRegister && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Caja:</span>
            <span className="font-medium">{receiptData.cashRegister}</span>
          </div>
        )}
        {receiptData.shift && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Turno:</span>
            <span className="font-medium">{receiptData.shift}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cajero:</span>
          <span className="font-medium">{receiptData.cashier}</span>
        </div>
        {receiptData.customer && (
          <>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{receiptData.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teléfono:</span>
              <span className="font-medium">{receiptData.customer.phone}</span>
            </div>
          </>
        )}
      </div>

      <Separator className="my-4" />

      {/* Detalle de productos */}
      <div className="mb-4 px-4 print:px-0">
        <h3 className="font-bold text-sm mb-3 text-center bg-muted/50 py-2 rounded print:bg-transparent print:border-y print:border-black print:rounded-none">
          DETALLE DE PRODUCTOS
        </h3>
        {receiptData.items.map((item, index) => (
          <div key={item.id} className="mb-3 pb-3 border-b border-dashed border-border/50 print:border-black last:border-0">
            <div className="flex justify-between items-start font-medium mb-1">
              <span className="flex-1 leading-tight">
                {item.name}
                {item.isService && (
                  <span className="ml-2 inline-block text-[10px] font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full print:border-black print:text-black print:bg-transparent">
                    SERVICIO
                  </span>
                )}
              </span>
              <span className="ml-3 font-bold whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>SKU: {item.sku}</span>
              <span>{item.quantity} x {formatCurrency(item.price)}</span>
            </div>
            {item.discount && item.discount > 0 && (
              <div className="flex justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 print:text-black">
                <span>Descuento:</span>
                <span>-{formatCurrency(item.discount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Resumen de totales */}
      <div className="mb-4 text-sm px-4 print:px-0 space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal ({receiptData.items.length} {receiptData.items.length === 1 ? 'item' : 'items'}):</span>
          <span className="font-medium">{formatCurrency(receiptData.subtotal)}</span>
        </div>
        {receiptData.totalDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium print:text-black">
            <span>Descuento:</span>
            <span>-{formatCurrency(receiptData.totalDiscount)}</span>
          </div>
        )}
        {receiptData.creditInfo && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100 print:bg-transparent print:border-black print:text-black">
            <div className="flex justify-between">
              <span>Subtotal contado:</span>
              <span>{formatCurrency(receiptData.creditInfo.baseTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Interés crédito ({receiptData.creditInfo.interestRate}%):</span>
              <span>+{formatCurrency(receiptData.creditInfo.interestAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total financiado:</span>
              <span>{formatCurrency(receiptData.creditInfo.financedTotal)}</span>
            </div>
            <div className="mt-1 text-xs">
              {receiptData.creditInfo.installmentCount} cuotas {receiptData.creditInfo.frequency} de {formatCurrency(receiptData.creditInfo.installmentAmount)}
            </div>
            <div className="mt-1 flex justify-between border-t border-blue-200 pt-1 text-xs font-semibold dark:border-blue-800 print:border-black">
              <span>Primera cuota:</span>
              <span>{formatPosCreditDueDate(receiptData.creditInfo.firstDueDate)}</span>
            </div>
          </div>
        )}

        {/* Desglose IVA */}
        <div className="border-t border-dashed border-border/50 print:border-black pt-2 mt-2 space-y-1">
          {(() => {
            const taxCfg = getTaxConfig()
            const rate = taxCfg.rate
            const inclTax = config.pricesIncludeTax
            const total = receiptData.total
            const base = inclTax ? Math.round(total / (1 + rate)) : receiptData.subtotal - receiptData.totalDiscount
            const iva = inclTax ? total - base : Math.round(base * rate)

            return (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{taxCfg.label} {taxCfg.percentage}% incluido:</span>
                <span>{formatCurrency(iva)}</span>
              </div>
            )
          })()}
        </div>

        <Separator className="my-3" />
        <div className="flex justify-between items-center bg-primary/10 dark:bg-primary/20 px-3 py-2.5 rounded-lg print:bg-transparent print:border-y print:border-black print:rounded-none">
          <span className="font-bold text-lg">TOTAL:</span>
          <span className="font-bold text-2xl text-primary print:text-black">{formatCurrency(receiptData.total)}</span>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-1">
          {config.pricesIncludeTax ? 'Precios con IVA incluido' : 'IVA calculado sobre el subtotal'}
        </p>
      </div>

      <Separator className="my-4" />

      {/* Métodos de pago */}
      <div className="mb-4 text-sm px-4 print:px-0">
        <h3 className="font-bold mb-3 text-center bg-muted/50 py-2 rounded print:bg-transparent print:border-y print:border-black print:rounded-none">FORMA DE PAGO</h3>
        <div className="space-y-2">
          {receiptData.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded print:px-0 print:bg-transparent">
              <span className="flex items-center gap-2">
                <span>{getPaymentMethodLabel(payment.method).replace(/^[^\s]+\s/, '')}</span>
                <span>
                  {payment.reference && ` (${payment.reference})`}
                  {payment.cardLast4 && ` ****${payment.cardLast4}`}
                </span>
              </span>
              <span className="font-bold">{formatCurrency(payment.amount)}</span>
            </div>
          ))}
          {receiptData.change && receiptData.change > 0 && (
            <div className="flex justify-between items-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded mt-2 print:text-black print:bg-transparent print:px-0">
              <span>Cambio:</span>
              <span>{formatCurrency(receiptData.change)}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-bold mt-3 bg-green-50 dark:bg-green-900/20 py-2 rounded print:text-black print:bg-transparent print:border print:border-black">
            <CheckCircle2 className="h-5 w-5 print:hidden" />
            <span>{receiptData.creditInfo ? 'CRÉDITO REGISTRADO' : 'PAGADO'}</span>
          </div>
        </div>
      </div>

      {/* Puntos de lealtad */}
      {receiptData.loyaltyPoints && receiptData.loyaltyPoints > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-4 text-sm text-center px-4 print:px-0">
            <div className="rounded-lg p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 print:bg-none print:border-black print:rounded-none">
              <span className="font-bold text-amber-700 dark:text-amber-400 text-base print:text-black">
                ¡Ganaste {receiptData.loyaltyPoints} puntos de lealtad!
              </span>
            </div>
          </div>
        </>
      )}

      <Separator className="my-4" />

      {/* Información de garantía */}
      <div className="mb-4 px-4 print:px-0">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center print:bg-transparent print:border-black print:rounded-none">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1 print:text-black">
            GARANTÍA: 30 días
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 print:text-black">
            Válido para cambios y reparaciones
          </p>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Pie del ticket */}
      <div className="text-center text-xs text-muted-foreground mb-4 px-4 print:px-0 space-y-1">
        <p className="font-bold text-sm text-foreground">¡Gracias por su compra!</p>
        <p>Conserve este ticket como comprobante</p>
        <p>Consultas: {companyInfo.phone}</p>
        {companyInfo.email && <p>{companyInfo.email}</p>}
        <Separator className="my-2" />
        <div className="border border-border/50 rounded p-2 text-[10px] text-muted-foreground/80 print:border-black print:rounded-none">
          <span className="font-semibold block mb-0.5">DOCUMENTO NO FISCAL</span>
          Este ticket es un comprobante interno de venta y NO tiene validez<br />
          tributaria ante la DNIT. No sustituye factura legal.<br />
          Solicite su factura con timbrado vigente si la necesita.
        </div>
        <p className="font-mono text-[10px] mt-2">
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
