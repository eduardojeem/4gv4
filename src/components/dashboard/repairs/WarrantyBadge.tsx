/**
 * WarrantyBadge Component
 * 
 * Displays warranty information as a badge with status indicator (Modern Design)
 */

import React from 'react'
import { Shield, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Repair } from '@/types/repairs'
import { 
  getWarrantyStatus, 
  getDaysRemaining, 
  getWarrantyStatusColor,
  formatWarrantyDuration 
} from '@/lib/warranty-utils'

interface WarrantyBadgeProps {
  repair: Repair
  showDaysRemaining?: boolean
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function WarrantyBadge({ 
  repair, 
  showDaysRemaining = false,
  showIcon = true,
  size = 'md',
  className 
}: WarrantyBadgeProps) {
  const warrantyMonths = repair.warrantyMonths || 0
  const expiresAt = repair.warrantyExpiresAt
  
  // No warranty
  if (warrantyMonths === 0) {
    return null
  }
  
  const status = getWarrantyStatus(expiresAt)
  const colors = getWarrantyStatusColor(status)
  const daysRemaining = getDaysRemaining(expiresAt)
  
  // Get status icon
  const StatusIcon = status === 'active' 
    ? CheckCircle2 
    : status === 'expiring' 
    ? Clock 
    : status === 'expired'
    ? AlertTriangle
    : Shield
  
  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  }
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  }
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-semibold transition-all duration-200 hover:scale-105 shadow-sm",
        colors.badge,
        colors.border,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <StatusIcon className={cn(iconSizes[size], colors.icon)} />}
      <span>
        {formatWarrantyDuration(warrantyMonths)}
      </span>
      {showDaysRemaining && status !== 'expired' && daysRemaining > 0 && (
        <span className={cn(
          "ml-1 font-normal opacity-75",
          size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'
        )}>
          ({daysRemaining}d)
        </span>
      )}
      {status === 'expired' && (
        <span className={cn(
          "ml-1 font-normal",
          size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'
        )}>
          ⚠️
        </span>
      )}
    </Badge>
  )
}

