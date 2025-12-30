/**
 * FilterToggle Component
 * Button to toggle filter panel visibility
 */

import React from 'react'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FilterToggleProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
}

export const FilterToggle = React.memo(function FilterToggle({
  isOpen,
  onToggle,
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
        'h-11',
        isOpen && 'bg-blue-50 border-blue-200',
        className
      )}
    >
      <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
      Filtros
    </Button>
  )
})
