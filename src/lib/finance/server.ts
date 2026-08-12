import type { AdminAuthContext } from '@/lib/api/withAdminAuth'
import { normalizeRole } from '@/lib/auth/role-utils'
import { resolveBranchScopeForUser } from '@/lib/branches/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import type { ExpenseInput } from './schemas'

type SupabaseErrorLike = {
  code?: string
  message?: string
}

export class FinanceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'FinanceApiError'
  }
}

const FINANCE_ERROR_MAPPINGS = [
  {
    tokens: ['FINANCE_IDEMPOTENCY_KEY_REUSED', 'FINANCE_OVERPAYMENT', '23505'],
    status: 409,
    code: 'FINANCE_CONFLICT',
    publicMessage: 'El pago entra en conflicto con el estado actual de la obligacion.',
  },
  {
    tokens: [
      'FINANCE_OBLIGATION_NOT_PAYABLE',
      'OPEN_CASH_SESSION_NOT_FOUND',
      'NON_CASH_PAYMENT_CANNOT_USE_CASH_SESSION',
      'CASH_SESSION_ONLY_ALLOWED_FOR_CASH_COMPENSATION',
      'FINANCE_INVALID_',
      '23514',
    ],
    status: 422,
    code: 'FINANCE_INVALID_STATE',
    publicMessage: 'La operacion no es valida para el estado actual.',
  },
  {
    tokens: [
      'FINANCE_BRANCH_PERMISSION_DENIED',
      'FINANCE_BRANCH_NOT_IN_ORGANIZATION',
      'FINANCE_PAYMENT_PERMISSION_DENIED',
      'FINANCE_VOID_PERMISSION_DENIED',
      'FINANCE_GENERATION_PERMISSION_DENIED',
      '42501',
    ],
    status: 403,
    code: 'FINANCE_FORBIDDEN',
    publicMessage: 'No tienes permiso para completar esta operacion financiera.',
  },
] as const

const INTERNAL_ERROR = {
  status: 500,
  code: 'FINANCE_INTERNAL_ERROR',
  publicMessage: 'No se pudo completar la operacion financiera.',
} as const

export function toFinanceApiError(error: unknown) {
  if (error instanceof FinanceApiError) return error

  const candidate = error as SupabaseErrorLike | null
  const rawMessage = candidate?.message ?? 'No se pudo completar la operacion financiera.'
  const haystack = `${candidate?.code ?? ''} ${rawMessage}`
  const mapping = FINANCE_ERROR_MAPPINGS.find(({ tokens }) =>
    tokens.some((token) => haystack.includes(token)),
  )

  if (mapping) {
    return new FinanceApiError(
      mapping.publicMessage,
      mapping.status,
      mapping.code,
    )
  }

  if (haystack.includes('FINANCE_OBLIGATION_NOT_FOUND')) {
    return new FinanceApiError(
      'La obligacion no existe.',
      404,
      'FINANCE_NOT_FOUND',
    )
  }

  return new FinanceApiError(
    INTERNAL_ERROR.publicMessage,
    INTERNAL_ERROR.status,
    INTERNAL_ERROR.code,
  )
}

export async function resolveFinanceOrganizationId(
  context: AdminAuthContext,
  requestedOrganizationId?: string,
) {
  if (context.organizationId) {
    if (
      requestedOrganizationId &&
      requestedOrganizationId !== context.organizationId
    ) {
      throw new FinanceApiError(
        'La organizacion solicitada no coincide con la organizacion activa.',
        403,
        'FINANCE_ORGANIZATION_FORBIDDEN',
      )
    }

    return context.organizationId
  }

  if (context.user.role !== 'super_admin' || !requestedOrganizationId) {
    throw new FinanceApiError(
      'Selecciona explicitamente una organizacion para el modo de soporte.',
      422,
      'FINANCE_ORGANIZATION_REQUIRED',
    )
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('organizations')
    .select('id')
    .eq('id', requestedOrganizationId)
    .maybeSingle()

  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError(
      'La organizacion solicitada no existe.',
      404,
      'FINANCE_ORGANIZATION_NOT_FOUND',
    )
  }

  return data.id as string
}

export async function assertFinanceBranchAccess(params: {
  context: AdminAuthContext
  organizationId: string
  branchId: string
}) {
  const scope = await resolveBranchScopeForUser({
    userId: params.context.user.id,
    role: normalizeRole(params.context.user.role),
    organizationId: params.organizationId,
    requestedBranchId: params.branchId,
    strict: true,
  }).catch(() => null)

  if (!scope?.branchId || scope.branchId !== params.branchId) {
    throw new FinanceApiError(
      'No tienes acceso a la sucursal solicitada.',
      403,
      'FINANCE_BRANCH_PERMISSION_DENIED',
    )
  }

  return scope.branch
}

export interface ObligationListFilters {
  startDate?: string
  endDate?: string
  branchId?: string
  categoryId?: string
  status?: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'voided'
  page: number
  pageSize: number
}

export async function listObligations(
  organizationId: string,
  filters: ObligationListFilters,
) {
  const admin = createAdminSupabase()
  const from = (filters.page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1
  let query = admin
    .from('finance_obligations')
    .select(
      'id, organization_id, branch_id, category_id, template_id, recurrence_period, concept, amount, paid_amount, currency, vendor, accounting_date, due_date, status, notes, void_reason, voided_at, created_at, updated_at, finance_categories(name, code)',
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .order('accounting_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.startDate) query = query.gte('accounting_date', filters.startDate)
  if (filters.endDate) query = query.lte('accounting_date', filters.endDate)
  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.status) query = query.eq('status', filters.status)

  const { data, error, count } = await query
  if (error) throw toFinanceApiError(error)

  return {
    obligations: data ?? [],
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / filters.pageSize),
    },
  }
}

export async function listFinanceCategories(
  organizationId: string,
  activeOnly: boolean,
) {
  const admin = createAdminSupabase()
  let query = admin
    .from('finance_categories')
    .select('id, organization_id, code, name, category_type, scope, is_system, is_active')
    .eq('organization_id', organizationId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw toFinanceApiError(error)
  return data ?? []
}

async function loadFinanceCategory(organizationId: string, categoryId: string) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('finance_categories')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('id', categoryId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError(
      'La categoria financiera no existe o esta inactiva.',
      422,
      'FINANCE_CATEGORY_INVALID',
    )
  }

  return data as { id: string; name: string }
}

function daysBetween(start: string, end?: string) {
  if (!end) return 0
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  const days = Math.round((endMs - startMs) / 86_400_000)

  if (days < 0 || days > 366) {
    throw new FinanceApiError(
      'La fecha de vencimiento debe estar entre 0 y 366 dias despues de la fecha contable.',
      422,
      'FINANCE_DUE_DATE_INVALID',
    )
  }

  return days
}

export async function createObligation(params: {
  organizationId: string
  userId: string
  input: ExpenseInput
}) {
  const { organizationId, userId, input } = params
  const admin = createAdminSupabase()
  const dueDays = daysBetween(input.accountingDate, input.dueDate)
  const category = await loadFinanceCategory(organizationId, input.categoryId)
  const concept = input.concept ?? category.name
  let templateId: string | null = null

  if (input.recurrence) {
    const { data: template, error: templateError } = await admin
      .from('finance_expense_templates')
      .insert({
        organization_id: organizationId,
        branch_id: input.branchId,
        category_id: input.categoryId,
        concept,
        amount: input.amount,
        vendor: input.vendor ?? null,
        notes: input.notes ?? null,
        frequency: input.recurrence.frequency,
        starts_on: input.recurrence.startsOn,
        ends_on: input.recurrence.endsOn ?? null,
        due_days_after_accounting: dueDays,
        status: 'active',
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single()

    if (templateError || !template) throw toFinanceApiError(templateError)
    templateId = template.id as string
  }

  const status =
    input.dueDate && input.dueDate < new Date().toISOString().slice(0, 10)
      ? 'overdue'
      : 'pending'
  const { data, error } = await admin
    .from('finance_obligations')
    .insert({
      organization_id: organizationId,
      branch_id: input.branchId,
      category_id: input.categoryId,
      template_id: templateId,
      recurrence_period: templateId ? input.recurrence!.startsOn : null,
      concept,
      amount: input.amount,
      currency: null,
      vendor: input.vendor ?? null,
      accounting_date: input.accountingDate,
      due_date: input.dueDate ?? null,
      status,
      notes: input.notes ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (templateId) {
      await admin
        .from('finance_expense_templates')
        .delete()
        .eq('organization_id', organizationId)
        .eq('branch_id', input.branchId)
        .eq('id', templateId)
    }
    throw toFinanceApiError(error)
  }

  return data
}

export type ExpenseUpdateInput = Partial<
  Omit<ExpenseInput, 'branchId' | 'recurrence'>
> & { branchId: string }

export async function updateUnpaidObligation(params: {
  organizationId: string
  obligationId: string
  userId: string
  input: ExpenseUpdateInput
}) {
  const { organizationId, obligationId, userId, input } = params
  const admin = createAdminSupabase()
  const { data: current, error: currentError } = await admin
    .from('finance_obligations')
    .select('id, branch_id, category_id, concept, amount, vendor, accounting_date, due_date, status, paid_amount, notes')
    .eq('organization_id', organizationId)
    .eq('branch_id', input.branchId)
    .eq('id', obligationId)
    .maybeSingle()

  if (currentError) throw toFinanceApiError(currentError)
  if (!current) {
    throw new FinanceApiError('La obligacion no existe.', 404, 'FINANCE_NOT_FOUND')
  }
  if (
    Number(current.paid_amount) !== 0 ||
    !['draft', 'pending', 'overdue'].includes(current.status)
  ) {
    throw new FinanceApiError(
      'Solo se pueden editar obligaciones sin pagos.',
      422,
      'FINANCE_OBLIGATION_NOT_EDITABLE',
    )
  }

  if (input.categoryId) {
    await loadFinanceCategory(organizationId, input.categoryId)
  }
  const accountingDate = input.accountingDate ?? current.accounting_date
  const dueDate = input.dueDate ?? current.due_date ?? undefined
  daysBetween(accountingDate, dueDate)

  const update = {
    ...(input.categoryId === undefined ? {} : { category_id: input.categoryId }),
    ...(input.concept === undefined ? {} : { concept: input.concept }),
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    ...(input.vendor === undefined ? {} : { vendor: input.vendor }),
    ...(input.accountingDate === undefined
      ? {}
      : { accounting_date: input.accountingDate }),
    ...(input.dueDate === undefined ? {} : { due_date: input.dueDate }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    updated_by: userId,
  }
  const { data, error } = await admin
    .from('finance_obligations')
    .update(update)
    .eq('organization_id', organizationId)
    .eq('branch_id', input.branchId)
    .eq('id', obligationId)
    .eq('paid_amount', 0)
    .in('status', ['draft', 'pending', 'overdue'])
    .select('*')
    .maybeSingle()

  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError(
      'La obligacion cambio mientras se editaba.',
      409,
      'FINANCE_STALE_OBLIGATION',
    )
  }
  return data
}

export async function voidObligation(params: {
  organizationId: string
  obligationId: string
  branchId: string
  reason: string
  cashSessionId?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('void_finance_obligation_atomic', {
    p_organization_id: params.organizationId,
    p_branch_id: params.branchId,
    p_obligation_id: params.obligationId,
    p_reason: params.reason,
    p_cash_session_id: params.cashSessionId ?? null,
  })

  if (error) throw toFinanceApiError(error)
  return data
}

export async function payObligation(params: {
  rpcName: 'pay_finance_obligation_atomic'
  rpcArgs: {
    p_organization_id: string
    p_branch_id: string
    p_obligation_id: string
    p_amount: number
    p_payment_method: 'cash' | 'bank_transfer' | 'other'
    p_payment_date: string
    p_idempotency_key: string
    p_cash_session_id: string | null
    p_reference: string | null
    p_notes: string | null
  }
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(params.rpcName, params.rpcArgs)

  if (error) throw toFinanceApiError(error)
  return data
}
