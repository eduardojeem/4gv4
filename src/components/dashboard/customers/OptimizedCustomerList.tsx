"use client"

import React, { memo, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Eye, 
  Edit, 
  History, 
  Phone, 
  Mail, 
  MapPin,
  Star,
  TrendingUp,
  Users
} from 'lucide-react'
import { LazyAvatar } from '@/components/ui/lazy-image'
import { useVirtualList, usePerformanceMonitor } from '@/hooks/use-virtual-list'
import { Customer } from '@/hooks/use-customer-state'
import { cn } from '@/lib/utils'

interface OptimizedCustomerListProps {
  customers: Customer[]
  onViewDetail: (customer: Customer) => void
  onViewHistory: (customer: Customer) => void
  onEdit?: (customer: Customer) => void
  viewMode?: 'table' | 'grid' | 'timeline'
  compact?: boolean
  virtualized?: boolean
  containerHeight?: number
}

// Memoized customer card component
const CustomerCard = memo(({ 
  customer, 
  onViewDetail, 
  onViewHistory, 
  onEdit,
  compact = false,
  style
}: {
  customer: Customer
  onViewDetail: (customer: Customer) => void
  onViewHistory: (customer: Customer) => void
  onEdit?: (customer: Customer) => void
  compact?: boolean
  style?: React.CSSProperties
}) => {
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }, [])

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'premium': return <Star className="h-4 w-4 text-yellow-500" />
      case 'empresa': return <Users className="h-4 w-4 text-blue-500" />
      default: return <Users className="h-4 w-4 text-gray-500" />
    }
  }, [])

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="absolute w-full"
    >
      <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-200 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardContent className={cn("p-4", compact && "p-3")}>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <LazyAvatar
              src={customer.avatar}
              name={customer.name}
              size={compact ? 'sm' : 'md'}
              priority={false}
            />

            {/* Customer Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn(
                  "font-semibold text-gray-900 dark:text-white truncate",
                  compact ? "text-sm" : "text-base"
                )}>
                  {customer.name}
                </h3>
                {getTypeIcon(customer.customer_type)}
                <Badge 
                  className={cn(
                    "text-xs",
                    getStatusColor(customer.status)
                  )}
                >
                  {customer.status}
                </Badge>
              </div>

              <div className={cn(
                "flex items-center gap-4 text-gray-600 dark:text-gray-400",
                compact ? "text-xs" : "text-sm"
              )}>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{customer.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{customer.phone}</span>
                </div>
                {customer.city && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{customer.city}</span>
                  </div>
                )}
              </div>

              {!compact && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>Gs {customer.lifetime_value.toLocaleString()}</span>
                  </div>
                  <span>•</span>
                  <span>{customer.total_purchases} compras</span>
                  <span>•</span>
                  <span>Cliente desde {new Date(customer.registration_date).getFullYear()}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetail(customer)}
                className="h-8 w-8 p-0"
                aria-label={`Ver detalles de ${customer.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewHistory(customer)}
                className="h-8 w-8 p-0"
                aria-label={`Ver historial de ${customer.name}`}
              >
                <History className="h-4 w-4" />
              </Button>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(customer)}
                  className="h-8 w-8 p-0"
                  aria-label={`Editar ${customer.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})

CustomerCard.displayName = 'CustomerCard'

export const OptimizedCustomerList = memo(({
  customers,
  onViewDetail,
  onViewHistory,
  onEdit,
  viewMode = 'table',
  compact = false,
  virtualized = true,
  containerHeight = 600
}: OptimizedCustomerListProps) => {
  const { renderCount, lastRenderTime } = usePerformanceMonitor('OptimizedCustomerList')

  const itemHeight = compact ? 80 : 120

  const {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerProps,
    innerProps
  } = useVirtualList({
    items: customers,
    itemHeight,
    containerHeight,
    overscan: 5,
    enabled: virtualized && customers.length > 50 // Only virtualize for large lists
  })

  const memoizedCustomers = useMemo(() => {
    return virtualItems.map(({ item: customer, index, offsetTop }) => (
      <CustomerCard
        key={customer.id}
        customer={customer}
        onViewDetail={onViewDetail}
        onViewHistory={onViewHistory}
        onEdit={onEdit}
        compact={compact}
        style={{
          top: offsetTop,
          height: itemHeight
        }}
      />
    ))
  }, [virtualItems, onViewDetail, onViewHistory, onEdit, compact, itemHeight])

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No hay clientes
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          No se encontraron clientes que coincidan con los filtros aplicados.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Performance info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 flex gap-4">
          <span>Renders: {renderCount}</span>
          <span>Last render: {lastRenderTime.toFixed(2)}ms</span>
          <span>Items: {customers.length}</span>
          <span>Virtualized: {virtualized && customers.length > 50 ? 'Yes' : 'No'}</span>
        </div>
      )}

      {/* Virtual list container */}
      <div {...containerProps} className="space-y-2">
        <div {...innerProps}>
          {memoizedCustomers}
        </div>
      </div>

      {/* Quick scroll buttons for large lists */}
      {customers.length > 100 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToIndex(0)}
          >
            Ir al inicio
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToIndex(Math.floor(customers.length / 2))}
          >
            Ir al medio
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToIndex(customers.length - 1)}
          >
            Ir al final
          </Button>
        </div>
      )}
    </div>
  )
})

OptimizedCustomerList.displayName = 'OptimizedCustomerList'