import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AfterSalesDashboard } from '@/components/dashboard/after-sales/AfterSalesDashboard'

export const metadata: Metadata = {
  title: 'Posventa | Dashboard',
  description: 'Garantias, cambios y devoluciones por organizacion.',
}

export default function AfterSalesPage() {
  return (
    <Suspense fallback={null}>
      <AfterSalesDashboard />
    </Suspense>
  )
}
