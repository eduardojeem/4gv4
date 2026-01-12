'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  CheckCircle, 
  XCircle, 
  Pause, 
  AlertTriangle, 
  ChevronDown,
  Power,
  PowerOff,
  Ban
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'pending'

interface StatusBadgeProps {
  status: CustomerStatus
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onStatusChange?: (newStatus: CustomerStatus) => void
  className?: string
}

const statusConfig = {
  active: {
    label: 'Activo',
    icon: CheckCircle,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50 hover:bg-emerald-200 dark:hover:bg-emerald-900/70',
    dotColor: 'bg-emerald-500'
  },
  inactive: {
    label: 'Inactivo',
    icon: XCircle,
    className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700/70',
    dotColor: 'bg-gray-500'
  },
  suspended: {
    label: 'Suspendido',
    icon: Ban,
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/50 hover:bg-red-200 dark:hover:bg-red-900/70',
    dotColor: 'bg-red-500'
  },
  pending: {
    label: 'Pendiente',
    icon: AlertTriangle,
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-900/70',
    dotColor: 'bg-amber-500'
  }
}

const sizeConfig = {
  sm: {
    badge: 'text-xs px-2 py-1 h-6',
    icon: 'h-3 w-3',
    dot: 'h-2 w-2'
  },
  md: {
    badge: 'text-sm px-3 py-1.5 h-7',
    icon: 'h-4 w-4',
    dot: 'h-2.5 w-2.5'
  },
  lg: {
    badge: 'text-sm px-4 py-2 h-8',
    icon: 'h-4 w-4',
    dot: 'h-3 w-3'
  }
}

export function StatusBadge({ 
  status, 
  size = 'md', 
  interactive = false, 
  onStatusChange,
  className 
}: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: 'Desconocido',
    icon: AlertTriangle,
    className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50',
    dotColor: 'bg-gray-400'
  }
  const sizeStyles = sizeConfig[size] ?? sizeConfig.md
  const Icon = config.icon

  if (!interactive || !onStatusChange) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'inline-flex items-center gap-1.5 font-medium transition-colors',
          config.className,
          sizeStyles.badge,
          className
        )}
      >
        <div className={cn('rounded-full', config.dotColor, sizeStyles.dot)} />
        <span>{config.label}</span>
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'inline-flex items-center gap-1.5 font-medium transition-all duration-200 hover:shadow-sm',
            config.className,
            sizeStyles.badge,
            'cursor-pointer',
            className
          )}
        >
          <div className={cn('rounded-full', config.dotColor, sizeStyles.dot)} />
          <span>{config.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
          Cambiar Estado
        </div>
        
        {Object.entries(statusConfig).map(([key, statusItem]) => {
          const StatusIcon = statusItem.icon
          const isCurrentStatus = key === status
          
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onStatusChange(key as CustomerStatus)}
              disabled={isCurrentStatus}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors',
                'hover:bg-gray-50 dark:hover:bg-gray-800',
                'focus:bg-gray-50 dark:focus:bg-gray-800',
                isCurrentStatus && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
              )}
            >
              <div className={cn('rounded-full', statusItem.dotColor, 'h-2 w-2')} />
              <span className="flex-1">{statusItem.label}</span>
              {isCurrentStatus && (
                <CheckCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Componente específico para toggle rápido de estado activo/inactivo
interface StatusToggleProps {
  status: CustomerStatus
  onToggle: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatusToggle({ 
  status, 
  onToggle, 
  disabled = false, 
  size = 'md',
  className 
}: StatusToggleProps) {
  const isActive = status === 'active'
  const sizeStyles = sizeConfig[size]

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2 font-medium transition-all duration-200',
        isActive 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50 dark:hover:bg-emerald-900/50'
          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700/50 dark:hover:bg-gray-700/50',
        sizeStyles.badge,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isActive ? (
        <Power className={cn('text-emerald-600 dark:text-emerald-400', sizeStyles.icon)} />
      ) : (
        <PowerOff className={cn('text-gray-500 dark:text-gray-400', sizeStyles.icon)} />
      )}
      <span>{isActive ? 'Activo' : 'Inactivo'}</span>
    </Button>
  )
}

// Componente para mostrar múltiples estados en bulk operations
interface BulkStatusSelectorProps {
  selectedCount: number
  onStatusChange: (status: CustomerStatus) => void
  className?: string
}

export function BulkStatusSelector({ 
  selectedCount, 
  onStatusChange, 
  className 
}: BulkStatusSelectorProps) {
  if (selectedCount === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'inline-flex items-center gap-2 font-medium',
            'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
            'dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50 dark:hover:bg-blue-900/50',
            className
          )}
        >
          <Power className="h-4 w-4" />
          <span>Cambiar Estado ({selectedCount})</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
          Cambiar estado de {selectedCount} cliente{selectedCount !== 1 ? 's' : ''}
        </div>
        
        {Object.entries(statusConfig).map(([key, statusItem]) => {
          const StatusIcon = statusItem.icon
          
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onStatusChange(key as CustomerStatus)}
              className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-gray-50 dark:focus:bg-gray-800"
            >
              <div className={cn('rounded-full', statusItem.dotColor, 'h-2 w-2')} />
              <span className="flex-1">{statusItem.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
