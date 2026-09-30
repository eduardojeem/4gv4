import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { getMaintenanceOverview } from '@/lib/superadmin/maintenance'
import { MaintenanceCenter, type MaintenanceTab } from '@/components/superadmin/maintenance/MaintenanceCenter'

export const metadata: Metadata = { title: 'Mantenimiento | Superadmin' }
export const dynamic = 'force-dynamic'

const TABS: MaintenanceTab[] = ['audit', 'storage', 'database', 'history']

export default async function SuperAdminMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireSuperAdmin()
  const [{ tab }, overview] = await Promise.all([searchParams, getMaintenanceOverview()])
  const initialTab = TABS.includes(tab as MaintenanceTab) ? (tab as MaintenanceTab) : 'audit'
  return <MaintenanceCenter overview={overview} initialTab={initialTab} />
}
