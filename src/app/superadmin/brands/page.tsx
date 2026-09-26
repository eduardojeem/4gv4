import type { Metadata } from 'next'
import { GlobalBrandsManager } from '@/components/superadmin/GlobalBrandsManager'

export const metadata: Metadata = {
  title: 'Catálogo de marcas | Super Admin',
}

export const dynamic = 'force-dynamic'

export default function SuperAdminBrandsPage() {
  return (
    <div className="p-4 sm:p-6">
      <GlobalBrandsManager />
    </div>
  )
}
