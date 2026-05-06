import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React, { useState } from 'react'
import { Clock, Receipt, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { PosStats } from "../hooks/usePosStats"
import { SaleDetailsModal } from '@/app/dashboard/pos/components/SaleDetailsModal'
import { formatCurrency } from '@/lib/currency'

interface RecentTransactionsListProps {
  sales: PosStats['recentSales']
}

export function RecentTransactionsList({ sales }: RecentTransactionsListProps) {
  const [open, setOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  const openDetails = (id: string) => {
    setSelectedSaleId(id)
    setOpen(true)
  }

  return (
    <Card className="col-span-4 border-border/60 shadow-sm overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Receipt className="mr-2 h-4 w-4 text-blue-600" />
          Ventas Recientes
          <span className="ml-auto text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
            Últimas transacciones
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-card">
            <div className="p-3 bg-muted/50 rounded-full mb-3">
              <Receipt className="h-6 w-6 opacity-40" />
            </div>
            <p className="font-medium text-sm">No hay ventas en este periodo</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
            {sales.map((sale: NonNullable<PosStats['recentSales']>[0]) => (
              <button
                key={sale.id}
                type="button"
                onClick={() => openDetails(sale.id)}
                className="w-full text-left p-4 hover:bg-muted/30 transition-colors group flex items-center justify-between"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="hidden sm:flex p-2 rounded-lg bg-blue-50/50 border border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50">
                    <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground flex items-center gap-2">
                      {sale.customer_name || 'Consumidor Final'}
                      <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/40">
                        {sale.id.substring(0, 8).toUpperCase()}
                      </span>
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(parseISO(sale.created_at), "d MMM, HH:mm", { locale: es })}
                      </span>
                      <span className="hidden md:flex items-center">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground mr-1.5" />
                        {sale.items_count} {sale.items_count === 1 ? 'artículo' : 'artículos'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm ml-4 shrink-0">
                  <div className="text-right">
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-semibold border-border/50 bg-background mb-0.5 px-1.5 py-0">
                      {sale.payment_method}
                    </Badge>
                    <p className="font-bold tabular-nums text-foreground">
                      {formatCurrency(Number(sale.total) || 0)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors hidden sm:block" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
      <SaleDetailsModal isOpen={open} onClose={() => setOpen(false)} saleId={selectedSaleId} />
    </Card>
  )
}
