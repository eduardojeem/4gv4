import React from 'react'
import { Layers, Package, Wrench, Tag, ChevronDown, Check, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GroupByMode } from '@/types/products-dashboard'
import { cn } from '@/lib/utils'

export interface GroupBySelectorProps {
  groupBy: GroupByMode
  onGroupByChange: (mode: GroupByMode) => void
  onSaveDefault?: () => void
  className?: string
  /** Sin módulo de servicios ni servicios cargados, agrupar por tipo no tiene sentido. */
  showServices?: boolean
}

export function GroupBySelector({
  groupBy,
  onGroupByChange,
  onSaveDefault,
  className,
  showServices = true,
}: GroupBySelectorProps) {
  const getLabel = () => {
    switch (groupBy) {
      case 'type':
        return 'Por Tipo'
      case 'category':
        return 'Por Categoría'
      case 'none':
      default:
        return 'Por Tipo / Desglose'
    }
  }

  const isGrouped = groupBy !== 'none'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-10 px-3.5 text-xs font-semibold rounded-xl gap-2 transition-all shadow-xs',
            isGrouped
              ? groupBy === 'type'
                ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-2xs ring-1 ring-purple-500/20'
                : 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500/20'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-800',
            className
          )}
          title="Desglosar catálogo en secciones"
        >
          <Layers className={cn('h-3.5 w-3.5', isGrouped ? (groupBy === 'type' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400') : 'text-slate-500')} />
          <span>{getLabel()}</span>
          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-2xl shadow-xl">
        <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
          Desglose de Secciones
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => onGroupByChange('none')}
          className={cn('flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer', groupBy === 'none' && 'bg-accent font-bold')}
        >
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <div className="flex flex-col">
              <span>Sin desglose (Lista continua)</span>
              <span className="text-[10px] text-muted-foreground font-normal">Todos los ítems en una sola lista</span>
            </div>
          </div>
          {groupBy === 'none' && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>

        {showServices && (
        <DropdownMenuItem
          onClick={() => onGroupByChange('type')}
          className={cn('flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer', groupBy === 'type' && 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold')}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-1">
              <Package className="h-3.5 w-3.5 text-indigo-500" />
              <Wrench className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div className="flex flex-col">
              <span>Por Tipo (Productos / Servicios)</span>
              <span className="text-[10px] text-muted-foreground font-normal">Separa productos y servicios técnicos</span>
            </div>
          </div>
          {groupBy === 'type' && <Check className="h-3.5 w-3.5 text-purple-600" />}
        </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => onGroupByChange('category')}
          className={cn('flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer', groupBy === 'category' && 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold')}
        >
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-blue-500" />
            <div className="flex flex-col">
              <span>Por Categoría</span>
              <span className="text-[10px] text-muted-foreground font-normal">Agrupa por familias de producto</span>
            </div>
          </div>
          {groupBy === 'category' && <Check className="h-3.5 w-3.5 text-blue-600" />}
        </DropdownMenuItem>

        {onSaveDefault && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSaveDefault}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Fijar desglose como predeterminado</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
