/**
 * ViewModeSelector Component
 * Toggle between grid, table, and compact view modes
 */

import React from 'react'
import { LayoutGrid, LayoutList, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ViewMode } from '@/types/products-dashboard'
import { cn } from '@/lib/utils'

export interface ViewModeSelectorProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  className?: string
}

export const ViewModeSelector = React.memo(function ViewModeSelector({
  viewMode,
  onViewModeChange,
  className
}: ViewModeSelectorProps) {
  return (
    <div 
      role="group" 
      aria-label="Selector de modo de vista"
      className={cn('flex items-center gap-0.5 border border-slate-200/90 dark:border-slate-800 rounded-xl p-1 bg-slate-100/70 dark:bg-slate-800/60 h-10 shadow-2xs', className)}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange('table')}
        aria-label="Vista de tabla"
        aria-pressed={viewMode === 'table'}
        title="Vista de tabla"
        className={cn(
          'h-8 w-8 rounded-lg transition-all',
          viewMode === 'table'
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60 font-bold hover:bg-white dark:hover:bg-slate-900'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60'
        )}
      >
        <LayoutList className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange('grid')}
        aria-label="Vista de cuadrícula"
        aria-pressed={viewMode === 'grid'}
        title="Vista de cuadrícula"
        className={cn(
          'h-8 w-8 rounded-lg transition-all',
          viewMode === 'grid'
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60 font-bold hover:bg-white dark:hover:bg-slate-900'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60'
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange('compact')}
        aria-label="Vista compacta"
        aria-pressed={viewMode === 'compact'}
        title="Vista compacta"
        className={cn(
          'h-8 w-8 rounded-lg transition-all',
          viewMode === 'compact'
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60 font-bold hover:bg-white dark:hover:bg-slate-900'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60'
        )}
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
})
