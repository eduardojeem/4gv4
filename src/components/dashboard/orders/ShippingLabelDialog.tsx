'use client'

import { useState } from 'react'
import {
  AlertTriangle, Building2, CheckCircle2, Layers,
  MapPin, Package, Phone, Printer, Store, Truck, User
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PAYMENT_METHOD_META } from '@/lib/orders/constants'
import type { CustomerOrder } from '@/lib/orders/types'
import { formatDate, formatMoney } from './format'

function parseVariantChips(variantName: string | null | undefined): string[] {
  if (!variantName || !variantName.trim()) return []
  const text = variantName.trim()
  if (text.includes('/') || text.includes('|') || text.includes('·') || text.includes(',')) {
    return text.split(/[/|·,]/).map((s) => s.trim()).filter(Boolean)
  }
  return [text]
}

function stripDuplicateVariantSuffix(productName: string, variantName?: string | null): string {
  if (!variantName || !variantName.trim()) return productName
  const escaped = variantName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return productName.replace(new RegExp(`\\s*\\(${escaped}\\)$`), '').trim()
}

interface ShippingLabelDialogProps {
  order?: CustomerOrder | null
  orders?: CustomerOrder[]
  open: boolean
  onOpenChange: (open: boolean) => void
  storeName?: string
  storePhone?: string
  branchNamesById?: Record<string, string>
}

export function ShippingLabelDialog({
  order,
  orders,
  open,
  onOpenChange,
  storeName = 'Tienda Online',
  storePhone,
  branchNamesById,
}: ShippingLabelDialogProps) {
  const [labelFormat, setLabelFormat] = useState<'label' | 'sheet'>('label')

  const targetOrders = orders && orders.length > 0 ? orders : order ? [order] : []
  if (targetOrders.length === 0) return null

  const isBulk = targetOrders.length > 1
  const singleOrder = targetOrders[0]

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-3xl p-0 gap-0 overflow-hidden sm:rounded-3xl border-border bg-background text-foreground shadow-2xl flex flex-col">
        {/* Header no imprimible */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {isBulk
                    ? `Rótulos de despacho (${targetOrders.length} pedidos)`
                    : `Rótulo de despacho y envío #${singleOrder.order_number}`}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isBulk
                    ? 'Cada pedido se imprimirá en su propia etiqueta o página para despegar sin cortes.'
                    : 'Imprime la etiqueta para el paquete o el remito para el repartidor.'}
                </DialogDescription>
              </div>
            </div>

            {/* Selector de formato */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="inline-flex rounded-xl bg-muted p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setLabelFormat('label')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    labelFormat === 'label'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Etiqueta Térmica (10x15)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelFormat('sheet')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    labelFormat === 'sheet'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Remito / Hoja A4
                </button>
              </div>

              <Button
                onClick={handlePrint}
                className="gap-1.5 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500 h-8 px-3 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Zona de previsualización e Impresión */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900/50 flex justify-center">
          {/* Renderizar reglas de impresión únicamente cuando el modal está abierto
              para evitar colisiones con el detalle u otras pantallas imprimibles. */}
          {open && (
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page { margin: 8mm; }
                body * {
                  visibility: hidden;
                }
                .printable-shipping-bundle, .printable-shipping-bundle * {
                  visibility: visible;
                }
                .printable-shipping-bundle {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .printable-shipping-container {
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 0 12mm 0 !important;
                  padding: 12px !important;
                  background: white !important;
                  color: black !important;
                  box-shadow: none !important;
                  border: 2px solid #000 !important;
                  break-inside: avoid;
                  break-after: page;
                  page-break-after: always;
                }
                .printable-shipping-container:last-of-type {
                  break-after: auto;
                  page-break-after: auto;
                  margin-bottom: 0 !important;
                }
              }
            `}} />
          )}

          <div className="printable-shipping-bundle w-full flex flex-col items-center gap-6">
            {targetOrders.map((itemOrder) => {
              const isDelivery = itemOrder.fulfillment_type === 'DELIVERY'
              const paymentMethodLabel = PAYMENT_METHOD_META[itemOrder.payment_method]?.label ?? itemOrder.payment_method
              const branchName = itemOrder.branch_id ? branchNamesById?.[itemOrder.branch_id] : undefined

              return (
                <div
                  key={itemOrder.id}
                  className={`printable-shipping-container w-full bg-white text-slate-900 rounded-2xl border-2 border-slate-900 p-5 shadow-md transition-all ${
                    labelFormat === 'label' ? 'max-w-[420px]' : 'max-w-2xl'
                  }`}
                >
                  {/* Header del Rótulo */}
                  <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                        {isDelivery ? 'RÓTULO DE ENVÍO / DESPACHO' : 'ORDEN DE RETIRO EN TIENDA'}
                      </span>
                      <h2 className="text-xl font-black tracking-tight font-mono text-slate-950">
                        #{itemOrder.order_number}
                      </h2>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Fecha: {formatDate(itemOrder.created_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-slate-900 text-white px-2.5 py-1 text-xs font-black uppercase tracking-wide">
                        {isDelivery ? <Truck className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                        <span>{isDelivery ? 'DELIVERY' : 'RETIRO'}</span>
                      </span>
                      <p className="text-[10px] font-bold text-slate-700 mt-1">
                        {storeName}
                      </p>
                      {branchName && (
                        <p className="text-[10px] font-medium text-slate-600 inline-flex items-center justify-end gap-1">
                          <Building2 className="h-2.5 w-2.5" />
                          {branchName}
                        </p>
                      )}
                      {storePhone && (
                        <p className="text-[10px] text-slate-500">
                          Tel: {storePhone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ficha Destinatario */}
                  <div className="rounded-xl border-2 border-slate-900 bg-slate-50 p-3.5 mb-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-800" />
                        DESTINATARIO
                      </span>
                      {itemOrder.customer_phone && (
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-700" />
                          {itemOrder.customer_phone}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-base font-black text-slate-950 leading-snug">
                        {itemOrder.customer_name}
                      </p>
                      {isDelivery && itemOrder.customer_address ? (
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-800 font-medium">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-900 mt-0.5" />
                          <p className="leading-tight font-semibold">{itemOrder.customer_address}</p>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs font-semibold text-slate-700 italic">
                          {isDelivery ? 'Dirección a coordinar con el cliente' : branchName ? `Retira en ${branchName}` : 'Retira en local / sucursal'}
                        </p>
                      )}
                    </div>

                    {itemOrder.notes && (
                      <div className="mt-2 rounded-lg bg-amber-100 border border-amber-300 p-2 text-[11px] text-amber-950 font-medium">
                        <strong>Indicaciones:</strong> {itemOrder.notes}
                      </div>
                    )}
                  </div>

                  {/* Aviso de Cobro / Cobro contra entrega */}
                  <div className="mb-3">
                    {itemOrder.amount_due > 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-rose-600 bg-rose-50 p-3 text-slate-900 text-center space-y-0.5">
                        <div className="flex items-center justify-center gap-1.5 text-rose-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            COBRAR EN DESTINO (CONTRA ENTREGA)
                          </span>
                        </div>
                        <p className="text-xl font-black text-rose-700 tabular-nums">
                          {formatMoney(itemOrder.amount_due)}
                        </p>
                        <p className="text-[10px] text-slate-600 font-medium">
                          Medio acordado: <strong className="text-slate-900">{paymentMethodLabel}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-emerald-700 bg-emerald-50 p-2.5 text-center flex items-center justify-center gap-2 text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          PEDIDO PAGADO - NO COBRAR
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contenido del Paquete / Productos */}
                  <div className="border-2 border-slate-900 rounded-xl overflow-hidden mb-3">
                    <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        CONTENIDO DEL PAQUETE ({itemOrder.order_items.length} {itemOrder.order_items.length === 1 ? 'ítem' : 'ítems'})
                      </span>
                      <span>CANT.</span>
                    </div>

                    <div className="divide-y divide-slate-200 text-xs">
                      {itemOrder.order_items.map((item) => {
                        const displayName = stripDuplicateVariantSuffix(item.product_name, item.variant_name)
                        return (
                          <div key={item.id} className="p-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-950 text-xs leading-snug">
                                {displayName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {item.variant_name && parseVariantChips(item.variant_name).map((chip, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-0.5 rounded bg-slate-100 border border-slate-300 px-1.5 py-0.2 text-[9px] font-bold text-slate-800"
                                  >
                                    <Layers className="h-2 w-2 text-slate-600" />
                                    {chip}
                                  </span>
                                ))}
                                {item.product_sku && (
                                  <span className="text-[9px] font-mono text-slate-500">
                                    SKU: {item.product_sku}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-block rounded-md bg-slate-900 text-white px-2 py-0.5 text-xs font-black tabular-nums">
                                {item.quantity} un.
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Sección de Firma y Control */}
                  <div className="border-t-2 border-dashed border-slate-300 pt-3 space-y-3 text-[10px] text-slate-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-bold uppercase text-slate-700 mb-5">Firma de recepción:</p>
                        <div className="border-b border-slate-400 w-full" />
                        <p className="mt-1 text-[9px] text-slate-400">— Firma —</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase text-slate-700 mb-1">Fecha y hora de entrega:</p>
                        <p className="text-[11px] font-mono text-slate-800 mt-5">_____ / _____ / 202___&nbsp;&nbsp;____:____ hs</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold uppercase text-slate-700 mb-5">Aclaración (nombre legible):</p>
                      <div className="border-b border-slate-400 w-full" />
                      <p className="mt-1 text-[9px] text-slate-400">— Aclaración —</p>
                    </div>
                  </div>

                  {/* Pie tracking */}
                  <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>TRACK: {itemOrder.id.slice(0, 8).toUpperCase()}-{itemOrder.order_number}</span>
                    <span>COMPROBANTE DE DESPACHO</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between print:hidden">
          <p className="text-xs text-muted-foreground">
            Asegúrate de ajustar los márgenes a cero en la ventana de impresión para un calce óptimo.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
              Cerrar
            </Button>
            <Button size="sm" onClick={handlePrint} className="rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500 text-xs gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              {isBulk ? `Imprimir ${targetOrders.length} rótulos` : 'Imprimir rótulo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
