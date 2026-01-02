'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy loading para componentes específicamente pesados
export const LazyReportsProductsPage = dynamic(
  () => import('@/app/dashboard/reports/products/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
)

export const LazyPOSSystem = dynamic(
  () => import('@/app/dashboard/pos/page'),
  {
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false
  }
)

// Componentes de gráficos pesados
export const LazyCharts = {
  LineChart: dynamic(() => import('recharts/es6/chart/LineChart').then(mod => ({ default: mod.LineChart })), {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  }),
  BarChart: dynamic(() => import('recharts/es6/chart/BarChart').then(mod => ({ default: mod.BarChart })), {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  }),
  PieChart: dynamic(() => import('recharts/es6/chart/PieChart').then(mod => ({ default: mod.PieChart })), {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  }),
  AreaChart: dynamic(() => import('recharts/es6/chart/AreaChart').then(mod => ({ default: mod.AreaChart })), {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false
  })
}

// Componentes de framer-motion lazy
export const LazyMotionComponents = {
  motion: dynamic(() => import('framer-motion').then(mod => ({ default: mod.motion })), {
    loading: () => <div />,
    ssr: false
  }),
  AnimatePresence: dynamic(() => import('framer-motion').then(mod => ({ default: mod.AnimatePresence })), {
    loading: () => <div />,
    ssr: false
  })
}

// Componentes de administración pesados
export const LazyAdminHeavyComponents = {
  DatabaseMonitoring: dynamic(() => import('@/components/admin/system/database-monitoring'), {
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
  }),
  
  InventoryManagement: dynamic(() => import('@/components/admin/inventory/inventory-management'), {
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
  }),
  
  SecurityPanel: dynamic(() => import('@/components/admin/system/security-panel'), {
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
  })
}