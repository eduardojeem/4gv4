import type { Metadata } from 'next'
import { GlobalProductsManager } from '@/components/superadmin/GlobalProductsManager'

export const metadata: Metadata = {
  title: 'Productos por código de barras | Super Admin',
}

export const dynamic = 'force-dynamic'

export default function SuperAdminGlobalProductsPage() {
  return (
    <div className="p-4 sm:p-6">
      <GlobalProductsManager />
    </div>
  )
}
