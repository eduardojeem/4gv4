'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy loading para componentes del admin
export const LazyAdminLayout = dynamic(
  () => import('@/app/admin/layout').then(mod => ({ default: mod.default })),
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

export const LazyAdminUsers = dynamic(
  () => import('@/app/admin/users/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyAdminAnalytics = dynamic(
  () => import('@/app/admin/analytics/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyAdminSecurity = dynamic(
  () => import('@/app/admin/security/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyAdminInventory = dynamic(
  () => import('@/app/admin/inventory/page'),
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

export const LazyAdminReports = dynamic(
  () => import('@/app/admin/reports/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)