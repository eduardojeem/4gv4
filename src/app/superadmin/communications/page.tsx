import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { getCommunicationsData } from '@/lib/superadmin/communications'
import { CommunicationsCenter, type CommunicationsTab } from '@/components/superadmin/communications/CommunicationsCenter'

export const metadata: Metadata = { title: 'Comunicaciones | Superadmin' }
export const dynamic = 'force-dynamic'

const TABS: CommunicationsTab[] = ['announcements', 'messages', 'email']

export default async function SuperAdminCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireSuperAdmin()
  const [{ tab }, data] = await Promise.all([searchParams, getCommunicationsData()])
  const initialTab = TABS.includes(tab as CommunicationsTab) ? (tab as CommunicationsTab) : 'announcements'
  return <CommunicationsCenter data={data} initialTab={initialTab} />
}
