import React from 'react'
import { Layers, Package, Wrench, Tag, ChevronDown, Check } from 'lucide-react'
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
  className?: string
}

export function GroupBySelector({
  groupBy,
  onGroupByChange,
  className
}: GroupBySelectorProps) {
  const getLabel = () => {
    switch (groupBy) {
      case 'type':
        return 'Por Tipo'
      case 'category':
        return 'Por Categoría'
      case 'none':
      default:
        return 'Desglosar'
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
            'h-9 px-3 text-xs font-semibold rounded-xl gap-1.5 transition-all shadow-xs',
            isGrouped
              ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
            className
          )}
          title="Desglosar catálogo en secciones"
        >
          <Layers className={cn('h-3.5 w-3.5', isGrouped ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500')} />
          <span>{getLabel()}</span>
          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl shadow-xl">
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
            <span>Sin desglose (Lista continua)</span>
          </div>
          {groupBy === 'none' && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onGroupByChange('type')}
          className={cn('flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer', groupBy === 'type' && 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold')}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-1">
              <Package className="h-3.5 w-3.5 text-indigo-500" />
              <Wrench className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <span>Por Tipo (Productos / Servicios)</span>
          </div>
          {groupBy === 'type' && <Check className="h-3.5 w-3.5 text-purple-600" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onGroupByChange('category')}
          className={cn('flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer', groupBy === 'category' && 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold')}
        >
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-blue-500" />
            <div className="flex flex-col">
              <span>Por Categoría</span>
              <span className="text-[10px] text-muted-foreground font-normal">Mayor espacio primero</span>
            </div>
          </div>
          {groupBy === 'category' && <Check className="h-3.5 w-3.5 text-blue-600" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
