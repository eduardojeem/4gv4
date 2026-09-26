import type { Metadata } from 'next'
import { GlobalCategoriesManager } from '@/components/superadmin/GlobalCategoriesManager'

export const metadata: Metadata = {
  title: 'Categorías globales | Super Admin',
}

export const dynamic = 'force-dynamic'

export default function SuperAdminCategoriesPage() {
  return (
    <div className="p-4 sm:p-6">
      <GlobalCategoriesManager />
    </div>
  )
}
