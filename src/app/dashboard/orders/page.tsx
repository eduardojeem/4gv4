import type { Metadata } from 'next'
import { OrdersDashboard } from '@/components/dashboard/orders/OrdersDashboard'

export const metadata: Metadata = {
  title: 'Pedidos | Dashboard',
  description: 'Gestion de pedidos ecommerce por organizacion.',
}

export default function DashboardOrdersPage() {
  return <OrdersDashboard />
}
