import type { Metadata } from 'next'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { getAuditPage, parseAuditFilters } from '@/lib/superadmin/audit-feed'
import { AuditCenter } from '@/components/superadmin/audit/AuditCenter'

export const metadata: Metadata = { title: 'Auditoría | Superadmin' }
export const dynamic = 'force-dynamic'

export default async function SuperAdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireSuperAdmin()
  const filters = parseAuditFilters(await searchParams)
  const admin = createAdminSupabase()
  const [page, orgs] = await Promise.all([
    getAuditPage(filters),
    admin.from('organizations').select('id, name').order('name'),
  ])
  return (
    <AuditCenter
      filters={filters}
      page={page}
      organizations={((orgs.data ?? []) as Array<{ id: string; name: string }>)}
    />
  )
}
