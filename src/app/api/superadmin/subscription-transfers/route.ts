import { createAdminSupabase } from '@/lib/supabase/admin'
import { bankTransferStatusSchema } from '@/lib/saas/bank-transfer-contract'
import { requireTransferSuperAdmin, transferError, transferJson } from '@/lib/saas/bank-transfer-api'
import { listBankTransferRequests } from '@/lib/saas/bank-transfers'

export async function GET(request: Request) {
  try {
    await requireTransferSuperAdmin()
    const params = new URL(request.url).searchParams
    const rawStatus = params.get('status') || 'pending_review'
    const status = rawStatus === 'all' ? undefined : bankTransferStatusSchema.parse(rawStatus)
    const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1))
    const list = await listBankTransferRequests({ status, page })
    const ids = [...new Set(list.requests.map(row => row.organization_id))]
    const names = new Map<string, string>()
    if (ids.length) {
      const { data, error } = await createAdminSupabase().from('organizations').select('id,name').in('id', ids)
      if (error) throw new Error('Organization lookup failed')
      for (const row of data ?? []) names.set(row.id, row.name)
    }
    return transferJson({ requests: list.requests.map(row => ({ ...row, organization_name: names.get(row.organization_id) || row.organization_id })), hasMore: list.pagination.hasMore, pagination: list.pagination })
  } catch (error) { return transferError(error) }
}
