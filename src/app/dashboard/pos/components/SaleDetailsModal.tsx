'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { useSales } from '@/hooks/useSales'
import { Calendar, User, CreditCard, FileText, ShoppingCart, Receipt } from 'lucide-react'

interface SaleDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  saleId: string | null
}

export function SaleDetailsModal({ isOpen, onClose, saleId }: SaleDetailsModalProps) {
  const { getSale } = useSales()
  const [loading, setLoading] = useState(false)
  const [sale, setSale] = useState<any>(null)

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
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Detalle de la Venta
            {sale && (
              <Badge variant="outline" className="ml-2">
                {sale.sale_number || (sale.id?.slice(0, 8) + '...')}
              </Badge>
            )}
          </DialogTitle>
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
                    <p className="text-lg font-bold">{sale.customer_name || 'Consumidor Final'}</p>
                    <p className="text-sm text-muted-foreground">
                      {sale.cashier_id ? `Cajero: ${sale.cashier_id}` : '—'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pago</span>
                    </div>
                    <p className="text-lg font-bold capitalize">{sale.payment_method}</p>
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
                      <span>{formatCurrency(sale.subtotal ?? (sale.total_amount - (sale.tax_amount || 0)))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA:</span>
                      <span>{formatCurrency(sale.tax_amount ?? sale.tax ?? 0)}</span>
                    </div>
                    {((sale.discount_amount ?? sale.discount) || 0) > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>Descuento:</span>
                        <span>-{formatCurrency(sale.discount_amount ?? sale.discount)}</span>
                      </div>
                    )}
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
                      {(sale.sale_items || sale.items || []).map((item: any) => (
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
              {Array.isArray(sale.payments) && sale.payments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Pagos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {sale.payments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                          <div className="capitalize">
                            {p.method}
                            {p.reference && (
                              <span className="ml-2 text-xs text-muted-foreground">({p.reference})</span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(p.amount)}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleString('es-PY')}
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
      </DialogContent>
    </Dialog>
  )
}

