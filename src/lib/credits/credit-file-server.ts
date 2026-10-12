import 'server-only'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import type { TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  CreditFilePolicySchema,
  type CreditFileDTO, type CreditFileInput, type CreditFileDecision,
  type CreditFilePolicy, type CreditFileSummary,
} from './credit-file-contract'

export class CreditFileError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
    this.name = 'CreditFileError'
  }
}

const uuid = z.string().uuid()
const managers = ['owner', 'admin', 'manager']
const summaryRoles = [...managers, 'seller']
type AdminClient = ReturnType<typeof createAdminSupabase>
type DatabaseError = { code?: string; message?: string }

export function requireCreditFileRole(context: TenantAuthContext, access: 'file' | 'summary' | 'policy-write' = 'file') {
  const allowed = access === 'summary' ? summaryRoles : access === 'policy-write' ? ['owner', 'admin'] : managers
  if (!allowed.includes(context.organization.role)) {
    throw new CreditFileError('CREDIT_FILE_FORBIDDEN', 403, 'No tenés permisos para acceder a esta ficha.')
  }
  if (!uuid.safeParse(context.user.id).success || !uuid.safeParse(context.organization.id).success) {
    throw new CreditFileError('CREDIT_FILE_FORBIDDEN', 403, 'No se pudo validar la organización o el usuario.')
  }
}

export async function creditFileCustomerId(routeContext: unknown) {
  const params = (routeContext as { params?: Promise<{ id?: unknown }> | { id?: unknown } } | undefined)?.params
  const result = uuid.safeParse((await params)?.id)
  if (!result.success) throw new CreditFileError('INVALID_CUSTOMER_ID', 400, 'Cliente inválido.')
  return result.data
}

export function throwCreditFileDatabaseError(error: DatabaseError): never {
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) {
    throw new CreditFileError('CREDIT_FILE_UNAVAILABLE', 503, 'La ficha para crédito todavía no está disponible. Revisá las migraciones y reintentá.')
  }
  if (error.code === '40001') throw new CreditFileError('CREDIT_FILE_VERSION_CONFLICT', 409, 'La ficha cambió en otra sesión. Recargá antes de guardar nuevamente.')
  if (error.code === '42501') throw new CreditFileError('CREDIT_FILE_FORBIDDEN', 403, 'No tenés permisos para realizar esta acción.')
  if (error.code === 'P0002') throw new CreditFileError('CREDIT_FILE_NOT_FOUND', 404, 'No se encontró el cliente o su ficha.')
  if (error.code === '23514') throw new CreditFileError('CREDIT_FILE_INCOMPLETE', 409, 'Revisá los requisitos pendientes antes de realizar esta acción.')
  if (error.code === '22023') throw new CreditFileError('INVALID_CREDIT_FILE', 400, 'Revisá los datos de la ficha.')
  throw new CreditFileError('CREDIT_FILE_ERROR', 500, 'No se pudo completar la operación de la ficha. Reintentá.')
}

export function creditFileResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
export function creditFileErrorResponse(error: unknown) {
  if (error instanceof CreditFileError) return creditFileResponse({ success: false, code: error.code, error: error.message }, error.status)
  return creditFileResponse({ success: false, code: 'CREDIT_FILE_ERROR', error: 'No se pudo completar la operación. Reintentá.' }, 500)
}

export async function creditFileCustomer(client: AdminClient, organizationId: string, customerId: string) {
  if (!uuid.safeParse(customerId).success || !uuid.safeParse(organizationId).success) throw new CreditFileError('INVALID_CUSTOMER_ID', 400, 'Cliente inválido.')
  const { data, error } = await client.from('customers').select('id, credit_limit').eq('id', customerId).eq('organization_id', organizationId).maybeSingle()
  if (error) throwCreditFileDatabaseError(error)
  if (!data) throw new CreditFileError('CUSTOMER_NOT_FOUND', 404, 'Cliente no encontrado.')
  return data as { id: string; credit_limit: number | string | null }
}

async function authorizedCustomer(context: TenantAuthContext, customerId: string, access: 'file' | 'summary' = 'file') {
  requireCreditFileRole(context, access)
  if (!uuid.safeParse(customerId).success) throw new CreditFileError('INVALID_CUSTOMER_ID', 400, 'Cliente inválido.')
  const client = createAdminSupabase()
  const customer = await creditFileCustomer(client, context.organization.id, customerId)
  return { client, customer }
}

async function readPolicy(client: AdminClient, organizationId: string): Promise<CreditFilePolicy> {
  const { data, error } = await client.from('organization_credit_file_policies').select('version, mode, require_identity, min_verified_references, required_documents').eq('organization_id', organizationId).maybeSingle()
  if (error) throwCreditFileDatabaseError(error)
  return CreditFilePolicySchema.parse(data ? { version: data.version, mode: data.mode, requireIdentity: data.require_identity, minVerifiedReferences: data.min_verified_references, requiredDocuments: data.required_documents } : {}) as CreditFilePolicy
}

export async function loadCreditFile(context: TenantAuthContext, customerId: string): Promise<CreditFileDTO | null> {
  const { client } = await authorizedCustomer(context, customerId)
  const { data, error } = await client.rpc('customer_credit_file_dto', { p_organization_id: context.organization.id, p_customer_id: customerId })
  if (error) throwCreditFileDatabaseError(error)
  return data as CreditFileDTO | null
}

export async function saveCreditFile(context: TenantAuthContext, customerId: string, input: CreditFileInput): Promise<CreditFileDTO> {
  const { client } = await authorizedCustomer(context, customerId)
  const { data, error } = await client.rpc('save_customer_credit_file', { p_organization_id: context.organization.id, p_customer_id: customerId, p_actor_id: context.user.id, p_expected_version: input.version, p_payload: input })
  if (error) throwCreditFileDatabaseError(error)
  return data as CreditFileDTO
}

export async function decideCreditFile(context: TenantAuthContext, customerId: string, input: CreditFileDecision): Promise<CreditFileDTO> {
  const { client } = await authorizedCustomer(context, customerId)
  const { data, error } = await client.rpc('decide_customer_credit_file', { p_organization_id: context.organization.id, p_customer_id: customerId, p_actor_id: context.user.id, p_expected_version: input.version, p_status: input.status, p_limit: input.limit ?? null, p_reason: input.reason })
  if (error) throwCreditFileDatabaseError(error)
  return data as CreditFileDTO
}

export async function loadCreditFilePolicy(context: TenantAuthContext) {
  requireCreditFileRole(context)
  return readPolicy(createAdminSupabase(), context.organization.id)
}

export async function saveCreditFilePolicy(context: TenantAuthContext, input: CreditFilePolicy) {
  requireCreditFileRole(context, 'policy-write')
  const { data, error } = await createAdminSupabase().rpc('save_customer_credit_file_policy', { p_organization_id: context.organization.id, p_actor_id: context.user.id, p_expected_version: input.version, p_payload: input })
  if (error) throwCreditFileDatabaseError(error)
  return data as CreditFilePolicy
}

export async function loadCreditFileSummary(context: TenantAuthContext, customerId: string): Promise<CreditFileSummary> {
  const { client, customer } = await authorizedCustomer(context, customerId, 'summary')
  const organizationId = context.organization.id
  const policy = await readPolicy(client, organizationId)
  // Do not fetch private DTOs for sellers, even internally.
  const file = await client.from('customer_credit_files').select('status').eq('organization_id', organizationId).eq('customer_id', customerId).maybeSingle()
  if (file.error) throwCreditFileDatabaseError(file.error)
  const missingResult = await client.rpc('customer_credit_file_missing', { p_organization_id: organizationId, p_customer_id: customerId, p_require_approval: true })
  if (missingResult.error) throwCreditFileDatabaseError(missingResult.error)
  const debt = await client.rpc('customer_credit_outstanding', { p_organization_id: organizationId, p_customer_id: customerId })
  if (debt.error) throwCreditFileDatabaseError(debt.error)
  const overdue = await client.rpc('customer_credit_overdue_count', { p_organization_id: organizationId, p_customer_id: customerId })
  if (overdue.error) throwCreditFileDatabaseError(overdue.error)
  const overdueCount = Math.max(0, Number(overdue.data ?? 0))
  const missing = missingResult.data as string[]
  const limit = Math.max(0, Number(customer.credit_limit ?? 0))
  const outstanding = Math.max(0, Number(debt.data ?? 0))
  return { status: file.data?.status ?? null, mode: policy.mode, missing, limit, outstanding, available: Math.max(0, limit - outstanding), overdueCount, eligible: missing.length === 0 }
}

/** UI guard improves feedback; the DB trigger is the final authority against races. */
export async function validateGenericCreditLimitUpdate(organizationId: string, customerId: string, proposedLimit: number | undefined) {
  if (proposedLimit === undefined) return
  const client = createAdminSupabase()
  const customer = await creditFileCustomer(client, organizationId, customerId)
  if (Number(customer.credit_limit ?? 0) === proposedLimit) return
  if ((await readPolicy(client, organizationId)).mode === 'required') {
    throw new CreditFileError('CREDIT_LIMIT_REQUIRES_DECISION', 409, 'El límite se cambia desde Ficha para crédito mediante una aprobación, no desde la edición general del cliente.')
  }
}
