/**
 * QuickFilterButton Component
 * Button for quick filter with count badge
 */

import React from 'react'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface QuickFilterButtonProps {
  label: string
  count: number
  isActive?: boolean
  onClick: () => void
  icon?: LucideIcon
  variant?: 'default' | 'warning' | 'danger' | 'success'
  className?: string
}

export const QuickFilterButton = React.memo(function QuickFilterButton({
  label,
  count,
  isActive = false,
  onClick,
  icon: Icon,
  variant = 'default',
  className
}: QuickFilterButtonProps) {
  const variantStyles = {
    default: 'hover:bg-blue-50 hover:border-blue-300',
    warning: 'border-amber-300 text-amber-700 hover:bg-amber-50',
    danger: 'border-red-300 text-red-700 hover:bg-red-50',
    success: 'border-green-300 text-green-700 hover:bg-green-50'
  }

  const activeStyles = {
    default: 'bg-blue-50 border-blue-300 text-blue-700',
    warning: 'bg-amber-50 border-amber-400 text-amber-800',
    danger: 'bg-red-50 border-red-400 text-red-800',
    success: 'bg-green-50 border-green-400 text-green-800'
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        'h-9',
        isActive ? activeStyles[variant] : variantStyles[variant],
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
      {label} ({count})
    </Button>
  )
})
