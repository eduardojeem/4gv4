'use client'

import { Repair } from '@/types/repairs'
import { RepairCard } from './RepairCard'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Eye, Pencil, Trash2, MoreVertical, PackageCheck, DollarSign, Shield } from 'lucide-react'
import { getRepairFinancialPresentation } from '@/lib/repairs/financial-closure'

interface RepairCardsViewProps {
  repairs: Repair[]
  onView?: (repair: Repair) => void
  onEdit?: (repair: Repair) => void
  onDelete?: (repairId: string) => void
  onDeliver?: (repair: Repair) => void
  onQuickPay?: (repair: Repair) => void
  onClaimWarranty?: (repair: Repair) => void
}

export function RepairCardsView({ repairs, onView, onEdit, onDelete, onDeliver, onQuickPay, onClaimWarranty }: RepairCardsViewProps) {
  if (repairs.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {repairs.map((repair) => {
        const financial = getRepairFinancialPresentation({
          status: repair.status,
          finalCost: repair.finalCost,
          estimatedCost: repair.estimatedCost,
          paidAmount: repair.paidAmount,
        })
        return (
        <div key={repair.id} className="relative group">
          <RepairCard
            repair={repair}
            onClick={onView ? () => onView(repair) : onEdit ? () => onEdit(repair) : undefined}
            className="h-full"
          />
          {/* Action menu — visible on hover */}
          <div className="absolute right-2 top-2 z-10 opacity-100 transition-opacity sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 shadow-sm bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onView?.(repair)}>
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Ver detalles
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(repair)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </DropdownMenuItem>
                )}
                {onQuickPay && financial.canCollect && (
                  <DropdownMenuItem
                    className="text-emerald-600 dark:text-emerald-400"
                    onClick={() => onQuickPay(repair)}
                  >
                    <DollarSign className="mr-2 h-3.5 w-3.5" />
                    {!financial.priceDefined
                      ? 'Registrar adelanto'
                      : repair.status === 'entregado' ? 'Cobrar saldo' : 'Cobrar aquí'}
                  </DropdownMenuItem>
                )}
                {onDeliver && repair.status === 'listo' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-emerald-600 dark:text-emerald-400"
                      onClick={() => onDeliver(repair)}
                    >
                      <PackageCheck className="mr-2 h-3.5 w-3.5" />
                      Marcar Entregado
                    </DropdownMenuItem>
                  </>
                )}
                {(repair.status === 'entregado' || repair.warrantyExpiresAt || (repair.warrantyMonths && repair.warrantyMonths > 0)) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-amber-700 dark:text-amber-400 font-semibold cursor-pointer"
                      onClick={() => onClaimWarranty ? onClaimWarranty(repair) : onView?.(repair)}
                    >
                      <Shield className="mr-2 h-3.5 w-3.5 text-amber-600" />
                      Procesar Garantía
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400"
                      onClick={() => onDelete(repair.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        )
      })}
    </div>
  )
}
