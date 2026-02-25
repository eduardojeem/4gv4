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
import { Eye, Pencil, Trash2, MoreVertical, PackageCheck } from 'lucide-react'

interface RepairCardsViewProps {
  repairs: Repair[]
  onView?: (repair: Repair) => void
  onEdit?: (repair: Repair) => void
  onDelete?: (repairId: string) => void
  onDeliver?: (repair: Repair) => void
}

export function RepairCardsView({ repairs, onView, onEdit, onDelete, onDeliver }: RepairCardsViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {repairs.map((repair) => (
        <div key={repair.id} className="relative group">
          <RepairCard
            repair={repair}
            onClick={() => onView?.(repair)}
            className="h-full"
          />
          {/* Action menu — visible on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 shadow-md"
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
                {onDeliver && repair.status !== 'entregado' && repair.status !== 'cancelado' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-300"
                      onClick={() => onDeliver(repair)}
                    >
                      <PackageCheck className="mr-2 h-3.5 w-3.5" />
                      Marcar Entregado
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
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
      ))}
    </div>
  )
}

