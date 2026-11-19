import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { listPendingAccountDeletions } from '@/lib/account/account-deletion'
import { PendingAccountDeletions } from '@/components/superadmin/account-deletions/PendingAccountDeletions'

export const metadata: Metadata = { title: 'Cuentas a eliminar | Superadmin' }
export const dynamic = 'force-dynamic'

export default async function SuperAdminAccountDeletionsPage() {
  await requireSuperAdmin()
  const requests = await listPendingAccountDeletions()
  return <PendingAccountDeletions requests={requests} />
}
