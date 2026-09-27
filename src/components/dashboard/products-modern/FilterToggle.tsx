/**
 * FilterToggle Component
 * Button to toggle filter panel visibility with active counter and state
 */

import React from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FilterToggleProps {
  isOpen: boolean
  onToggle: () => void
  activeCount?: number
  className?: string
}

export const FilterToggle = React.memo(function FilterToggle({
  isOpen,
  onToggle,
  activeCount = 0,
  className
}: FilterToggleProps) {
  return (
    <Button
      variant="outline"
      size="default"
      onClick={onToggle}
      aria-label={isOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
      aria-expanded={isOpen}
      aria-controls="filter-panel"
      className={cn(
        'h-10 px-3.5 text-xs font-semibold rounded-xl gap-2 transition-all shadow-xs',
        isOpen
          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-xs ring-2 ring-blue-500/10'
          : activeCount > 0
          ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
          : 'border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
        className
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Filtros</span>
      {activeCount > 0 && (
        <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 px-1 text-[10px] font-bold text-white leading-none">
          {activeCount}
        </span>
      )}
      <ChevronDown className={cn('h-3 w-3 opacity-60 transition-transform duration-200', isOpen && 'rotate-180')} />
    </Button>
  )
})
