'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy loading para componentes grandes específicos
export const LazyProductModal = dynamic(
  () => import('@/components/dashboard/product-modal'),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false
  }
)

export const LazySupplierModal = dynamic(
  () => import('@/components/dashboard/supplier-modal'),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false
  }
)

export const LazyCustomerModal = dynamic(
  () => import('@/components/dashboard/customer-modal'),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false
  }
)

export const LazyRepairFormDialog = dynamic(
  () => import('@/components/dashboard/repair-form-dialog-v2'),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false
  }
)

export const LazyInventoryManagement = dynamic(
  () => import('@/components/admin/inventory/inventory-management'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyUserManagement = dynamic(
  () => import('@/components/admin/users/user-management'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazySecurityPanel = dynamic(
  () => import('@/components/admin/system/security-panel'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyDatabaseMonitoring = dynamic(
  () => import('@/components/admin/system/database-monitoring'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyAnalyticsDashboard = dynamic(
  () => import('@/components/dashboard/customers/AnalyticsDashboard'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazySegmentationSystem = dynamic(
  () => import('@/components/dashboard/customers/SegmentationSystem'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyKanbanBoard = dynamic(
  () => import('@/components/repairs/KanbanBoard'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-full" />
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-24 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyChartComponents = dynamic(
  () => import('@/components/charts/ChartWrapper'),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  }
)