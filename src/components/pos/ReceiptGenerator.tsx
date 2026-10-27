'use client'

import { AppImage } from '@/components/ui/app-image'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, Download, Share2, CheckCircle2 } from 'lucide-react'
import { config } from '@/lib/config'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatPosCreditDueDate } from '@/lib/credits/pos-credit-summary'
import { buildReceiptPaymentSummary, firstPaymentChange, type ReceiptDocumentKind } from '@/lib/receipt-utils'

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
  method: 'cash' | 'card' | 'transfer' | 'credit' | 'store_credit'
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
  raffleTickets?: {
    raffleName: string
    ticketNumbers: number[]
    drawDate?: string
  }
  creditInfo?: {
    baseTotal: number
    interestAmount: number
    financedTotal: number
    installmentCount: number
    installmentAmount: number
    frequency: string
    interestRate: number
    firstDueDate: string
    firstInstallmentTiming?: 'at_start' | 'next_cycle'
    startDate?: string
    lastInstallmentAmount?: number
    firstPayment?: { amount: number; method: 'cash' | 'transfer'; bank?: string; reference?: string; cashReceived?: number; change?: number; paymentId: string }
    remainingBalance?: number
    installments?: Array<{ number: number; dueDate: string; amount: number }>
  }
}

interface ReceiptGeneratorProps {
  receiptData: ReceiptData
  /**
   * Acciones propias del ticket. Opcionales: el modal del POS ya tiene su barra
   * de acciones, y mostrarlas dos veces confundia al cajero.
   */
  onPrint?: () => void
  onDownload?: () => void
  onShare?: () => void
  formatCurrency: (amount: number) => string
  documentKind?: ReceiptDocumentKind
}

export const ReceiptGenerator: React.FC<ReceiptGeneratorProps> = ({
  receiptData,
  onPrint,
  onDownload,
  onShare,
  formatCurrency,
  documentKind = 'internal',
}) => {
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
    // Solo el slogan configurado: uno fijo decia "Servicio Tecnico" en el ticket
    // de una tienda de ropa.
    slogan: websiteSettings?.company_info?.slogan?.trim() || '',
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito',
      store_credit: 'Saldo a favor',
    }
    return labels[method as keyof typeof labels] || method
  }

  const creditInfo = receiptData.creditInfo
  const summary = buildReceiptPaymentSummary(receiptData)
  const collectedToday = summary.collectedToday
  const financedBalance = summary.financedBalance
  const totalWithFinancing = summary.totalWithFinancing
  const paymentState = summary.paymentState
  const customerPhone = receiptData.customer?.phone?.trim()
  const hasActions = Boolean(onPrint || onDownload || onShare)

  return (
    <div id="receipt-content" className="mx-auto w-full max-w-[320px] bg-white text-black rounded-sm shadow-md border border-neutral-300 print:max-w-full print:shadow-none print:border-none print:rounded-none print:mx-0 print:bg-transparent print:text-black">
      {/* Encabezado mejorado con logo */}
      <div className="text-center border-b-2 border-dashed border-neutral-300 pb-4 mb-4 bg-gradient-to-b from-neutral-100 to-transparent pt-4 print:bg-transparent print:border-black">
        {/* Initials placeholder */}
        <div className="flex justify-center mb-2">
          {logoUrl ? (
            <AppImage src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white font-bold text-2xl print:border print:border-black print:bg-transparent print:text-black">
              {companyInfo.name ? companyInfo.name.substring(0, 2).toUpperCase() : 'Mi'}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-tight">{companyInfo.name}</h1>
        {companyInfo.slogan && (
          <p className="text-sm font-medium text-black print:text-black">{companyInfo.slogan}</p>
        )}
        {companyInfo.ruc && (
          <p className="text-xs font-semibold text-neutral-700 mt-1 print:text-black">RUC: {companyInfo.ruc}</p>
        )}
        {companyInfo.address && <p className="text-xs text-neutral-700 print:text-black">{companyInfo.address}</p>}
        {companyInfo.phone && <p className="text-xs text-neutral-700 print:text-black">Tel: {companyInfo.phone}</p>}
        {companyInfo.email && <p className="text-xs text-neutral-700 print:text-black">Email: {companyInfo.email}</p>}
      </div>

      {/* Número de ticket destacado */}
      <div className="mx-4 mb-4 flex items-center justify-between rounded-md border-2 border-black px-3 py-2 print:mx-0 print:rounded-none print:border-black">
        <span className="text-sm font-bold">Ticket Nº</span>
        <span className="font-mono text-lg font-black">{receiptData.receiptNumber}</span>
      </div>

      {/* Información de la venta */}
      <div className="mb-4 text-sm space-y-1 px-4 print:px-0">
        <div className="flex justify-between">
          <span className="text-neutral-700">Fecha:</span>
          <span className="font-semibold">{receiptData.date} {receiptData.time}</span>
        </div>
        {receiptData.cashRegister && (
          <div className="flex justify-between">
            <span className="text-neutral-700">Caja:</span>
            <span className="font-medium">{receiptData.cashRegister}</span>
          </div>
        )}
        {receiptData.shift && (
          <div className="flex justify-between">
            <span className="text-neutral-700">Turno:</span>
            <span className="font-medium">{receiptData.shift}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-neutral-700">Cajero:</span>
          <span className="font-medium">{receiptData.cashier}</span>
        </div>
        {receiptData.customer && (
          <>
            <Separator className="my-2" />
            <div className="flex justify-between gap-3">
              <span className="text-neutral-700">Cliente:</span>
              <span className="text-right font-bold">{receiptData.customer.name}</span>
            </div>
            {customerPhone && (
              <div className="flex justify-between">
                <span className="text-neutral-700">Teléfono:</span>
                <span className="font-semibold">{customerPhone}</span>
              </div>
            )}
          </>
        )}
      </div>

      <Separator className="my-4" />

      {/* Detalle de productos */}
      <div data-receipt-products="compact" className="mb-3 px-4 text-xs print:px-0">
        <h3 className="mb-2 rounded bg-neutral-100 py-1.5 text-center text-[11px] font-bold print:rounded-none print:border-y print:border-black print:bg-transparent">
          DETALLE DE PRODUCTOS
        </h3>
        {receiptData.items.map((item, _index) => (
          <div key={item.id} className="mb-2 border-b border-dashed border-neutral-300 pb-2 last:mb-0 last:border-0 print:border-black">
            <div className="mb-0.5 flex items-start justify-between gap-2 font-medium leading-tight">
              <span className="min-w-0 flex-1 break-words">
                {item.name}
                {item.isService && (
                  <span className="ml-2 inline-block text-[10px] font-semibold text-blue-600 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full print:border-black print:text-black print:bg-transparent">
                    SERVICIO
                  </span>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap font-bold">{formatCurrency(item.price * item.quantity)}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-neutral-700">
              {item.sku && <span>SKU: {item.sku}</span>}
              <span>{item.quantity} x {formatCurrency(item.price)}</span>
            </div>
            {(item.discount ?? 0) > 0 && (
              <div className="flex justify-between text-xs font-medium text-emerald-600 mt-1 print:text-black">
                <span>Descuento:</span>
                <span>-{formatCurrency(item.discount ?? 0)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Resumen de totales */}
      <div className="mb-4 text-sm px-4 print:px-0 space-y-1">
        <div className="flex justify-between">
          <span className="text-neutral-700">Subtotal ({receiptData.items.length} {receiptData.items.length === 1 ? 'item' : 'items'}):</span>
          <span className="font-medium">{formatCurrency(receiptData.subtotal)}</span>
        </div>
        {receiptData.totalDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium print:text-black">
            <span>Descuento:</span>
            <span>-{formatCurrency(receiptData.totalDiscount)}</span>
          </div>
        )}
        {creditInfo && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 text-blue-900 print:bg-transparent print:border-black print:text-black">
            <div className="flex justify-between">
              <span>Capital financiado:</span>
              <span>{formatCurrency(creditInfo.baseTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Costo financiero:</span>
              <span>+{formatCurrency(creditInfo.interestAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total financiado:</span>
              <span>{formatCurrency(creditInfo.financedTotal)}</span>
            </div>
            <div className="mt-1 text-xs">
              {creditInfo.installmentCount} cuotas {creditInfo.frequency === 'weekly' ? 'semanales' : creditInfo.frequency === 'biweekly' ? 'quincenales' : 'mensuales'} desde {formatCurrency(creditInfo.installmentAmount)}
            </div>
            <div className="mt-1 flex justify-between border-t border-blue-200 pt-1 text-xs font-semibold print:border-black">
              <span>Primera cuota:</span>
              <span>{formatPosCreditDueDate(creditInfo.firstDueDate)}</span>
            </div>
            {creditInfo.lastInstallmentAmount !== undefined && creditInfo.lastInstallmentAmount !== creditInfo.installmentAmount && <p className="text-xs">Última cuota: {formatCurrency(creditInfo.lastInstallmentAmount)}.</p>}
            {creditInfo.firstPayment ? <div className="mt-2 border-t pt-2 text-xs">
              <p className="font-bold">Primera cuota PAGADA: {formatCurrency(creditInfo.firstPayment.amount)}</p>
              <p>Medio: {creditInfo.firstPayment.method === 'cash' ? 'Efectivo' : 'Transferencia'}</p>
              {creditInfo.firstPayment.method === 'transfer' && <p>{creditInfo.firstPayment.bank ? `Banco/cuenta: ${creditInfo.firstPayment.bank}. ` : ''}Referencia: {creditInfo.firstPayment.reference}</p>}
              {creditInfo.firstPayment.method === 'cash' && <p>Recibido: {formatCurrency(creditInfo.firstPayment.cashReceived ?? creditInfo.firstPayment.amount)}</p>}
              {firstPaymentChange(creditInfo.firstPayment) > 0 && <p className="font-semibold">Vuelto de la cuota: {formatCurrency(firstPaymentChange(creditInfo.firstPayment))}</p>}
              <p>Saldo del crédito al emitir: {formatCurrency(financedBalance)}</p>
              <p>Este cobro cancela la cuota 1; no es un cargo adicional.</p>
            </div> : <p className="mt-2 text-xs">Cuotas pendientes de cobro. El vencimiento no acredita su pago.</p>}
          </div>
        )}
        {documentKind === 'fiscal' && receiptData.tax > 0 && (
          <div className="flex justify-between text-xs text-neutral-700">
            <span>IVA incluido:</span>
            <span>{formatCurrency(receiptData.tax)}</span>
          </div>
        )}

        <Separator className="my-2" />
        <div
          data-receipt-total={creditInfo ? 'financed' : 'standard'}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-neutral-100 px-2.5 py-2 print:rounded-none print:border-y print:border-black print:bg-transparent"
        >
          <span className="min-w-0 pr-1 text-xs font-bold leading-tight">{creditInfo ? 'TOTAL CON FINANCIACIÓN:' : 'TOTAL:'}</span>
          <span className="shrink-0 whitespace-nowrap text-base font-bold text-black print:text-black">{formatCurrency(creditInfo ? totalWithFinancing : receiptData.total)}</span>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Métodos de pago */}
      <div className="mb-4 text-sm px-4 print:px-0">
        <h3 className="font-bold mb-3 text-center bg-neutral-100 py-2 rounded print:bg-transparent print:border-y print:border-black print:rounded-none">FORMA DE PAGO</h3>
        <div className="space-y-2">
          {receiptData.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between items-center bg-neutral-50 px-3 py-2 rounded print:px-0 print:bg-transparent">
              <span className="flex items-center gap-2">
                <span className="font-semibold">{getPaymentMethodLabel(payment.method)}</span>
                <span>
                  {payment.reference && ` (${payment.reference})`}
                  {payment.cardLast4 && ` ****${payment.cardLast4}`}
                </span>
              </span>
              <span className="font-bold">{formatCurrency(payment.amount)}</span>
            </div>
          ))}
          {!creditInfo && (receiptData.change ?? 0) > 0 && (
            <div className="flex justify-between items-center font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded mt-2 print:text-black print:bg-transparent print:px-0">
              <span>Cambio:</span>
              <span>{formatCurrency(receiptData.change ?? 0)}</span>
            </div>
          )}
          {creditInfo && (
            <div className="mt-2 space-y-1 border-t border-dashed pt-2 text-sm">
              <div className="flex justify-between"><span>Cobrado hoy:</span><strong>{formatCurrency(collectedToday)}</strong></div>
              <div className="flex justify-between"><span>Saldo financiado:</span><strong>{formatCurrency(financedBalance)}</strong></div>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 text-green-600 font-bold mt-3 bg-green-50 py-2 rounded print:text-black print:bg-transparent print:border print:border-black">
            <CheckCircle2 className="h-5 w-5 print:hidden" />
            <span>{paymentState}</span>
          </div>
        </div>
      </div>

      {/* Puntos de lealtad */}
      {(receiptData.loyaltyPoints ?? 0) > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-4 text-sm text-center px-4 print:px-0">
            <div className="rounded-lg p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 print:bg-none print:border-black print:rounded-none">
              <span className="font-bold text-amber-700 text-base print:text-black">
                ¡Ganaste {receiptData.loyaltyPoints} puntos de lealtad!
              </span>
            </div>
          </div>
        </>
      )}

      {/* Sorteos automáticos ganados en la compra */}
      {receiptData.raffleTickets && receiptData.raffleTickets.ticketNumbers.length > 0 && (
        <>
          <Separator className="my-4" />
          <div className="mb-4 text-sm text-center px-4 print:px-0">
            <div className="rounded-lg p-3 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 print:bg-none print:border-black print:rounded-none">
              <span className="font-extrabold text-rose-700 text-sm print:text-black block mb-1">
                🎟️ ¡Estás participando del {receiptData.raffleTickets.raffleName}!
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1 font-mono font-bold text-xs">
                {receiptData.raffleTickets.ticketNumbers.map((num) => (
                  <span key={num} className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md border border-rose-200 print:border-black print:text-black">
                    #{num}
                  </span>
                ))}
              </div>
              {receiptData.raffleTickets.drawDate && (
                <span className="text-[11px] text-rose-600 block mt-1 print:text-black">
                  Fecha del sorteo: {receiptData.raffleTickets.drawDate}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <Separator className="my-4" />

      {/* Pie del ticket */}
      <div className="text-center text-xs text-neutral-700 mb-4 px-4 print:px-0 space-y-1">
        <p className="font-bold text-sm text-black">¡Gracias por su compra!</p>
        <p>Conserve este ticket como comprobante</p>
        <Separator className="my-2" />
        {documentKind === 'internal' && <div className="border border-neutral-300 rounded p-2 text-[10px] text-neutral-700 print:border-black print:rounded-none">
          <span className="font-semibold block mb-0.5">DOCUMENTO NO FISCAL</span>
          Este ticket es un comprobante interno de venta y NO tiene validez<br />
          tributaria ante la DNIT. No sustituye factura legal.<br />
          Solicite su factura con timbrado vigente si la necesita.
        </div>}
      </div>

      {/* Botones de acción */}
      {hasActions && (
        <div className="flex gap-2 mt-6 px-4 pb-4 print:hidden">
          {onPrint && (
            <Button onClick={onPrint} className="flex-1" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          )}
          {onDownload && (
            <Button onClick={onDownload} variant="outline" className="flex-1" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          )}
          {onShare && (
            <Button onClick={onShare} variant="outline" className="flex-1" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default ReceiptGenerator
