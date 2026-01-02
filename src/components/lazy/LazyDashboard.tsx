'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy loading para componentes del dashboard
export const LazyDashboardLayout = dynamic(
  () => import('@/app/dashboard/layout').then(mod => ({ default: mod.default })),
  {
    loading: () => (
      <div className="flex h-screen">
        <Skeleton className="w-64 h-full" />
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyProductsPage = dynamic(
  () => import('@/app/dashboard/products/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyRepairsPage = dynamic(
  () => import('@/app/dashboard/repairs/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyCustomersPage = dynamic(
  () => import('@/app/dashboard/customers/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyPOSPage = dynamic(
  () => import('@/app/dashboard/pos/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyReportsPage = dynamic(
  () => import('@/app/dashboard/reports/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)