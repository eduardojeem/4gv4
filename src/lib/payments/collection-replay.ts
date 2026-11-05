import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { collectionResultSchema, type CollectionRequest, type CollectionResult } from '@/lib/credits/collection-contract'
import { PaymentControlError } from './control-contract'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}'
  return JSON.stringify(value)
}
/** This identity matches collect_customer_payment_atomic's persisted request_identity. */
export function matchingCollectionReplay(stored: { request: unknown; result: unknown } | null, input: {
  organizationId: string; customerId: string; actorId: string; branchId: string; request: CollectionRequest
}): CollectionResult | null {
  if (!stored || canonical(stored.request) !== canonical({ customer: input.customerId, branch: input.branchId, actor: input.actorId, payload: input.request })) return null
  const result = collectionResultSchema.safeParse(stored.result)
  return result.success ? result.data : null
}
export async function recoverCollectionReplay(input: {
  organizationId: string; customerId: string; actorId: string; branchId: string; request: CollectionRequest
}): Promise<CollectionResult | null> {
  const { data, error } = await createAdminSupabase().from('customer_collection_requests').select('request, result')
    .eq('organization_id', input.organizationId).eq('idempotency_key', input.request.idempotencyKey).maybeSingle()
  if (error) throw new PaymentControlError('No se pudo comprobar el resultado del cobro. Reintentá con el mismo identificador.')
  return matchingCollectionReplay(data, input)
}
