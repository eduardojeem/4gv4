import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getStatusConfig } from '@/lib/formatters'

interface StatusBadgeProps {
  status: string
  variant?: 'customer' | 'transaction' | 'repair' | 'payment'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-2.5 py-1.5',
  lg: 'text-base px-3 py-2'
}

export function StatusBadge({ 
  status, 
  variant = 'customer', 
  size = 'md',
  className 
}: StatusBadgeProps) {
  const config = getStatusConfig(status, variant)
  
  return (
    <Badge 
      className={cn(
        config.bg,
        config.text,
        config.dark,
        sizeClasses[size],
        'font-medium border-0',
        className
      )}
    >
      {status}
    </Badge>
  )
}

// Variantes específicas para casos comunes
export function CustomerStatusBadge({ status, size, className }: Omit<StatusBadgeProps, 'variant'>) {
  return <StatusBadge status={status} variant="customer" size={size} className={className} />
}

export function TransactionStatusBadge({ status, size, className }: Omit<StatusBadgeProps, 'variant'>) {
  return <StatusBadge status={status} variant="transaction" size={size} className={className} />
}