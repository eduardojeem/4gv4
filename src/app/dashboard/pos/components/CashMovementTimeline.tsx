'use client'

import React from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowUpCircle, ArrowDownCircle, DollarSign, History, 
  Clock, FileText 
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface CashMovementTimelineProps {
  movements: any[]
}

export function CashMovementTimeline({ movements }: CashMovementTimelineProps) {
  if (!movements || movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border rounded-md border-dashed bg-muted/20">
        <History className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No hay movimientos en este turno</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[400px] w-full pr-4">
      <div className="relative border-l border-muted ml-4 space-y-6 py-2">
        {movements.map((movement, i) => {
          const isSale = movement.type === 'sale'
          const isIn = movement.type === 'in' || movement.type === 'cash_in'
          const isOut = movement.type === 'out' || movement.type === 'cash_out'
          const isSystem = movement.type === 'opening' || movement.type === 'closing'

          return (
            <div key={movement.id || i} className="relative pl-6">
              <span className={`absolute -left-2.5 top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${
                isSale ? 'bg-blue-100 text-blue-600' :
                isIn ? 'bg-green-100 text-green-600' :
                isOut ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                {isSale && <DollarSign className="h-3 w-3" />}
                {isIn && <ArrowUpCircle className="h-3 w-3" />}
                {isOut && <ArrowDownCircle className="h-3 w-3" />}
                {isSystem && <History className="h-3 w-3" />}
              </span>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold leading-none">
                    {isSale ? 'Venta' :
                     isIn ? 'Ingreso de Caja' :
                     isOut ? 'Retiro de Caja' :
                     movement.type === 'opening' ? 'Apertura de Caja' :
                     'Cierre de Caja'}
                  </p>
                  <span className={`text-sm font-bold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                    {isOut ? '-' : '+'}{formatCurrency(movement.amount)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {new Date((movement as any).timestamp || (movement as any).created_at).toLocaleTimeString()}
                  </span>
                  {(movement.note || movement.reason) && (
                    <>
                      <span>•</span>
                      <FileText className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">
                        {movement.note || movement.reason}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
