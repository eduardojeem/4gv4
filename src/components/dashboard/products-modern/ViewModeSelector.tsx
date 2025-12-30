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
      className={cn('flex items-center gap-1 border rounded-lg p-1 bg-gray-50', className)}
    >
      <Button
        variant={viewMode === 'table' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onViewModeChange('table')}
        aria-label="Vista de tabla"
        aria-pressed={viewMode === 'table'}
        title="Vista de tabla"
        className="h-9 w-9"
      >
        <LayoutList className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onViewModeChange('grid')}
        aria-label="Vista de cuadrícula"
        aria-pressed={viewMode === 'grid'}
        title="Vista de cuadrícula"
        className="h-9 w-9"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onViewModeChange('compact')}
        aria-label="Vista compacta"
        aria-pressed={viewMode === 'compact'}
        title="Vista compacta"
        className="h-9 w-9"
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
})
