'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { useSales } from '@/hooks/useSales'
import { Calendar, User, CreditCard, FileText, ShoppingCart, Receipt, Printer, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { printReceipt, CompanyInfo } from '@/lib/receipt-utils'
import { buildReprintReceiptData, type StoredSale } from '@/lib/after-sales/sale-receipt'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { config } from '@/lib/config'
import { CreateAfterSalesCaseDialog } from '@/components/dashboard/after-sales/CreateAfterSalesCaseDialog'
import { paymentMethodLabel } from '@/lib/i18n/labels'

export interface SaleDetailItem {
  id: string
  product_id?: string
  product_name?: string
  products?: { name?: string; sku?: string } | null
  sku?: string
  quantity: number
  price?: number
  unit_price?: number
  discount?: number
  /** Columna real de sale_items: el descuento de la línea en moneda. */
  discount_amount?: number | null
  subtotal?: number
  total?: number
  is_service?: boolean
}

export interface SaleDetailPayment {
  id: string
  method?: string
  payment_method?: string
  payment_index?: number
  amount: number
  reference?: string
  card_last4?: string
  created_at?: string
}

type SaleDetailCustomer = { name?: string | null; phone?: string | null; email?: string | null }

export interface SaleDetailRecord {
  id: string
  /** Código guardado por el POS (sales.code). */
  code?: string | null
  sale_number?: string
  customer?: SaleDetailCustomer | SaleDetailCustomer[] | null
  subtotal_amount?: number | null
  created_by?: string | null
  sale_payments?: SaleDetailPayment[] | null
  created_at: string
  customer_id?: string | null
  customer_name?: string | null
  cashier_id?: string | null
  total_amount?: number
  total?: number
  subtotal?: number
  tax_amount?: number
  tax?: number
  discount_amount?: number
  discount?: number
  change_amount?: number
  payment_method?: string
  payment_status?: string
  notes?: string
  sale_items?: SaleDetailItem[]
  items?: SaleDetailItem[]
  payments?: SaleDetailPayment[]
}

function toReceiptPaymentMethod(method?: string): 'cash' | 'card' | 'transfer' | 'credit' | 'store_credit' {
  if (method === 'card' || method === 'tarjeta') return 'card'
  if (method === 'transfer' || method === 'transferencia' || method === 'sipap' || method === 'qr') return 'transfer'
  if (method === 'credit' || method === 'credito') return 'credit'
  if (method === 'store_credit') return 'store_credit'
  return 'cash'
}

function saleItems(sale: SaleDetailRecord) {
  return sale.sale_items || sale.items || []
}

/** Pagos de la venta: los del POS viven en sale_payments; `payments` es la tabla anterior. */
export function salePayments(sale: SaleDetailRecord): SaleDetailPayment[] {
  const rows = sale.sale_payments?.length ? sale.sale_payments : (sale.payments || [])
  return [...rows].sort((a, b) => (a.payment_index ?? 0) - (b.payment_index ?? 0))
}

export function saleReference(sale: SaleDetailRecord) {
  return sale.code || sale.sale_number || sale.id.slice(0, 8).toUpperCase()
}

/**
 * Subtotal bruto guardado. Antes se mostraba total - IVA: con precios con IVA
 * incluido y un descuento, «Subtotal - Descuento» no daba el total.
 */
export function saleSubtotal(sale: SaleDetailRecord) {
  return Number(sale.subtotal_amount ?? sale.subtotal ?? (Number(sale.total_amount ?? sale.total ?? 0) + Number(sale.discount_amount ?? sale.discount ?? 0)))
}

export function toStoredSale(sale: SaleDetailRecord): StoredSale {
  const customer = Array.isArray(sale.customer) ? sale.customer[0] : sale.customer
  return {
    id: sale.id,
    code: sale.code || sale.sale_number || null,
    createdAt: sale.created_at,
    subtotal: saleSubtotal(sale),
    tax: Number(sale.tax_amount ?? sale.tax ?? 0),
    discount: Number(sale.discount_amount ?? sale.discount ?? 0),
    total: Number(sale.total_amount ?? sale.total ?? 0),
    paymentMethod: sale.payment_method ?? null,
    customer: customer?.name ? customer : (sale.customer_name ? { name: sale.customer_name } : null),
    items: saleItems(sale).map(item => ({
      id: item.id,
      product_id: item.product_id ?? null,
      name: item.products?.name || item.product_name || 'Producto',
      sku: item.products?.sku || item.sku || null,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
      discount: item.discount_amount ?? item.discount ?? null,
    })),
    payments: salePayments(sale).map(payment => ({
      id: payment.id,
      method: toReceiptPaymentMethod(payment.payment_method ?? payment.method),
      amount: Number(payment.amount) || 0,
      reference: payment.reference ?? null,
    })),
  }
}

interface SaleDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  saleId: string | null
}

export function SaleDetailsModal({ isOpen, onClose, saleId }: SaleDetailsModalProps) {
  const { getSale } = useSales()
  const { settings } = useSharedSettings()
  const [loading, setLoading] = useState(false)
  const [sale, setSale] = useState<SaleDetailRecord | null>(null)
  const [afterSalesOpen, setAfterSalesOpen] = useState(false)

  const handlePrintReceipt = () => {
    if (!sale) return

    const companyInfo: CompanyInfo = {
        name: settings.companyName || config.company.name,
        address: settings.companyAddress || config.company.address,
        phone: settings.companyPhone || config.company.phone,
        email: settings.companyEmail || config.company.email,
        ruc: settings.companyRuc
    }

    // Mismo armado que la reimpresión de Posventa: número y fecha originales,
    // descuento por línea en moneda y los pagos de sale_payments.
    printReceipt(buildReprintReceiptData(toStoredSale(sale)), companyInfo)
  }

  useEffect(() => {
    const fetch = async () => {
      if (!saleId || !isOpen) return
      setLoading(true)
      const data = await getSale(saleId)
      setSale(data)
      setLoading(false)
    }
    fetch()
  }, [saleId, isOpen, getSale])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Detalle de la Venta
                {sale && (
                <Badge variant="outline" className="ml-2">
                    {saleReference(sale)}
                </Badge>
                )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Consulta el resumen completo de la venta, sus items y la información del comprobante.
            </DialogDescription>
            {!loading && sale && (
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAfterSalesOpen(true)}>
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Posventa
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Copia
                    </Button>
                </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {loading && (
            <div className="p-4 text-sm text-muted-foreground">Cargando detalle...</div>
          )}

          {!loading && sale && (
            <>
              {/* Información principal */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Fecha</span>
                    </div>
                    <p className="text-lg font-bold">
                      {new Date(sale.created_at).toLocaleDateString('es-PY')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.created_at).toLocaleTimeString('es-PY')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Cliente</span>
                    </div>
                    <p className="text-lg font-bold">{toStoredSale(sale).customer?.name || 'Consumidor Final'}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pago</span>
                    </div>
                    <p className="text-lg font-bold">{paymentMethodLabel(sale.payment_method)}</p>
                    <Badge variant={sale.payment_status === 'paid' ? 'default' : 'secondary'} className="mt-1">
                      {sale.payment_status === 'paid' ? 'Pagada' : sale.payment_status}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Resumen monetario */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Resumen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(saleSubtotal(sale))}</span>
                    </div>
                    {((sale.discount_amount ?? sale.discount) || 0) > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>Descuento:</span>
                        <span>-{formatCurrency(sale.discount_amount ?? sale.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>{config.pricesIncludeTax ? 'IVA incluido:' : 'IVA:'}</span>
                      <span>{formatCurrency(sale.tax_amount ?? sale.tax ?? 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-primary">{formatCurrency(sale.total_amount ?? sale.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items vendidos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[260px] w-full pr-4">
                    <div className="space-y-3 text-sm">
                      {(sale.sale_items || sale.items || []).map((item: SaleDetailItem) => (
                        <div key={item.id} className="flex justify-between border-b pb-2 last:border-0 last:pb-0">
                          <div>
                            <p className="font-medium">{item.products?.name || item.product_name}</p>
                            <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency((item.subtotal ?? item.total ?? 0))}</div>
                            <div className="text-xs text-muted-foreground">
                              Unit: {formatCurrency(item.price ?? item.unit_price ?? 0)}
                            </div>
                            {Number(item.discount_amount ?? item.discount ?? 0) > 0 && (
                              <div className="text-xs text-primary">
                                Descuento: -{formatCurrency(Number(item.discount_amount ?? item.discount))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(sale.sale_items || sale.items || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          Sin items
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Pagos registrados */}
              {salePayments(sale).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Pagos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {salePayments(sale).map((p: SaleDetailPayment) => (
                        <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                          <div>
                            {paymentMethodLabel(p.payment_method ?? p.method)}
                            {p.reference && (
                              <span className="ml-2 text-xs text-muted-foreground">({p.reference})</span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(p.amount)}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.created_at ? new Date(p.created_at).toLocaleString('es-PY') : '-'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {sale && (
          <CreateAfterSalesCaseDialog
            open={afterSalesOpen}
            onOpenChange={setAfterSalesOpen}
            sourceType="sale"
            saleId={sale.id}
            customerId={sale.customer_id || null}
            reference={saleReference(sale)}
            customerName={toStoredSale(sale).customer?.name || null}
            allowedRequestTypes={['product_warranty', 'exchange', 'return']}
            saleItems={(sale.sale_items || sale.items || []).map((item: {
              id: string | number
              product_id?: string | null
              product_name?: string
              name?: string
              products?: { name?: string; image_url?: string | null } | null
              unit_price?: number | string
              quantity?: number | string
            }) => ({
              id: String(item.id),
              product_id: item.product_id ?? null,
              name: item.product_name || item.name || item.products?.name || 'Producto',
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unit_price) || 0,
              imageUrl: item.products?.image_url ?? null,
            }))}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
