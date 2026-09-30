import type { Metadata } from 'next'
import { GlobalDeviceModelsManager } from '@/components/superadmin/GlobalDeviceModelsManager'

export const metadata: Metadata = {
  title: 'Modelos de equipos | Super Admin',
}

export const dynamic = 'force-dynamic'

export default function SuperAdminDeviceModelsPage() {
  return (
    <div className="p-4 sm:p-6">
      <GlobalDeviceModelsManager />
    </div>
  )
}
