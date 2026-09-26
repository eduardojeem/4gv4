'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PauseCircle, PlayCircle, Trash2, ShoppingCart, User, Clock, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { HeldSale } from '../hooks/useHeldSales'

interface HeldSalesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  heldSales: HeldSale[]
  onRestoreSale: (sale: HeldSale) => void
  onDeleteSale: (id: string) => void
  onClearAll: () => void
  currentCartHasItems: boolean
}

export function HeldSalesModal({
  open,
  onOpenChange,
  heldSales,
  onRestoreSale,
  onDeleteSale,
  onClearAll,
  currentCartHasItems
}: HeldSalesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <PauseCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Ventas en Espera ({heldSales.length})</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Recupera tickets pausados para continuar con el cobro
                </DialogDescription>
              </div>
            </div>
            {heldSales.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                onClick={onClearAll}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Vaciar todas
              </Button>
            )}
          </div>
        </DialogHeader>

        {currentCartHasItems && heldSales.length > 0 && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Atención:</strong> Tienes productos en el carrito actual. Al recuperar una venta en espera, se reemplazará el carrito actual (puedes pausarlo antes si deseas).
            </span>
          </div>
        )}

        <div className="p-6 pt-3">
          {heldSales.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
                <PauseCircle className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground">No hay ventas en espera</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Puedes poner ventas en espera presionando el botón <strong className="text-amber-600 dark:text-amber-400">Pausar Venta</strong> o con la tecla <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">F8</kbd>.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="space-y-3">
                {heldSales.map((sale) => {
                  const saleItems = sale.cart || sale.items || []
                  const saleTitle = sale.label || sale.title || `Venta en espera (${saleItems.length} ítems)`
                  const saleDate = sale.formattedDate || (sale.createdAt ? new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')

                  return (
                    <div
                      key={sale.id}
                      className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {saleTitle}
                          </span>
                          {sale.isWholesale && (
                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Mayorista
                            </Badge>
                          )}
                          {sale.discount > 0 && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Desc. {sale.discount}%
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {sale.customerName || 'Cliente'}
                          </span>
                          {saleDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {saleDate}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            {saleItems.length} producto{saleItems.length !== 1 ? 's' : ''} ({saleItems.reduce((acc, i) => acc + i.quantity, 0)} u.)
                          </span>
                        </div>

                        {/* Lista compacta de items */}
                        <div className="text-xs text-muted-foreground/80 line-clamp-1 pt-0.5">
                          {saleItems.map(i => `${i.quantity}x ${i.name}`).join(' • ')}
                        </div>
                      </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="text-base font-bold text-primary">
                        {formatCurrency(sale.total)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => onDeleteSale(sale.id)}
                          title="Eliminar esta venta pausada"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                          onClick={() => {
                            onRestoreSale(sale)
                            onOpenChange(false)
                          }}
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Recuperar
                        </Button>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
