/**
 * MetricsGrid Component
 * Displays a grid of metric cards showing key inventory statistics
 */

import React from 'react'
import { Package2, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import { MetricCard } from './MetricCard'
import { DashboardMetrics } from '@/types/products-dashboard'
import { formatLargeNumber } from '@/lib/products-dashboard-utils'

export interface MetricsGridProps {
  metrics: DashboardMetrics
  onMetricClick?: (metric: 'all' | 'low_stock' | 'out_of_stock' | 'value') => void
}

export function MetricsGrid({ metrics, onMetricClick }: MetricsGridProps) {
  const formattedValue = formatLargeNumber(metrics.inventory_value)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Products Card */}
      <MetricCard
        title="Total Productos"
        value={metrics.total_products}
        subtitle="En inventario"
        icon={Package2}
        gradient="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20"
        iconBg="bg-blue-500 dark:bg-blue-600"
        textColor="text-blue-700 dark:text-blue-300"
        onClick={() => onMetricClick?.('all')}
      />

      {/* Low Stock Card */}
      <MetricCard
        title="Bajo Stock"
        value={metrics.low_stock_count}
        subtitle="Requieren atención"
        icon={AlertTriangle}
        gradient="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20"
        iconBg="bg-amber-500 dark:bg-amber-600"
        textColor="text-amber-700 dark:text-amber-300"
        onClick={() => onMetricClick?.('low_stock')}
      />

      {/* Out of Stock Card */}
      <MetricCard
        title="Agotados"
        value={metrics.out_of_stock_count}
        subtitle="Sin existencias"
        icon={TrendingUp}
        gradient="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20"
        iconBg="bg-red-500 dark:bg-red-600"
        textColor="text-red-700 dark:text-red-300"
        onClick={() => onMetricClick?.('out_of_stock')}
        className="[&_svg]:rotate-180"
      />

      {/* Inventory Value Card */}
      <MetricCard
        title="Valor Total"
        value={`$${formattedValue}`}
        subtitle="En inventario"
        icon={DollarSign}
        gradient="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20"
        iconBg="bg-green-500 dark:bg-green-600"
        textColor="text-green-700 dark:text-green-300"
        onClick={() => onMetricClick?.('value')}
      />
    </div>
  )
}
