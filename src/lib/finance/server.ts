import type { AdminAuthContext } from '@/lib/api/withAdminAuth'
import { normalizeRole } from '@/lib/auth/role-utils'
import { resolveBranchScopeForUser } from '@/lib/branches/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { chunkQueryValues } from '@/lib/analytics/query-batches'
import { calculateFinancialSummary } from '@/lib/finance/calculations'
import { isCompletedSaleStatus } from '@/lib/sales-status'
import { z } from 'zod'

import type {
  CommissionRuleInput,
  CompensationInput,
  ExpenseInput,
  PayrollAdjustmentInput,
  PayrollGenerationInput,
  PayrollPaymentInput,
} from './schemas'
import type { FinanceFilters, FinanceSummary } from './types'

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

const PAYROLL_ERROR_MAPPINGS = [
  {
    tokens: [
      'PAYROLL_GENERATION_IDEMPOTENCY_KEY_REUSED',
      'PAYROLL_PAYMENT_IDEMPOTENCY_KEY_REUSED',
      'PAYROLL_PERIOD_ALREADY_GENERATED',
      'PAYROLL_COMMISSION_RULE_PERIOD_OVERLAP',
      'PAYROLL_COMPENSATION_PERIOD_OVERLAP',
      'PAYROLL_OVERPAYMENT',
    ],
    status: 409,
    code: 'PAYROLL_CONFLICT',
    publicMessage: 'La nómina entra en conflicto con su estado actual.',
  },
  {
    tokens: [
      'PAYROLL_INVALID_',
      'PAYROLL_ADJUSTMENT_',
      'PAYROLL_APPROVED_',
      'PAYROLL_CASH_',
      'PAYROLL_BRANCH_NOT_IN_ORGANIZATION',
      'PAYROLL_COMMISSION_REVERSAL_',
      'PAYROLL_COMMISSION_SNAPSHOT_MISMATCH',
      'PAYROLL_ENTRY_COMMISSION_',
      'PAYROLL_ENTRY_COMMISSIONS_',
      'PAYROLL_ENTRY_NOT_PAYABLE',
      'PAYROLL_ENTRY_REQUIRES_',
      'PAYROLL_ENTRY_ROLE_',
      'PAYROLL_ENTRY_SCOPE_',
      'PAYROLL_ORGANIZATION_REQUIRED',
      'PAYROLL_PAYMENT_BRANCH_MISMATCH',
      'PAYROLL_PAYMENT_DATE_REQUIRED',
      'PAYROLL_PAYMENT_STATE_MUST_MATCH_LEDGER',
      'PAYROLL_PAYMENTS_ARE_APPEND_ONLY',
      'PAYROLL_REFUND_',
      'PAYROLL_REVERSAL_',
      'PAYROLL_RUN_HAS_NO_ENTRIES',
      'PAYROLL_RUN_NOT_APPROVABLE',
      'PAYROLL_RUN_TOTALS_MISMATCH',
      'PAYROLL_RUN_WITH_CLAIMS_CANNOT_BE_VOIDED',
      'PAYROLL_UNSUPPORTED_',
      'PAYROLL_USED_COMPENSATION_IS_IMMUTABLE',
    ],
    status: 422,
    code: 'PAYROLL_INVALID_STATE',
    publicMessage: 'La operación de nómina no es válida para el estado actual.',
  },
  {
    tokens: [
      'PAYROLL_APPROVAL_PERMISSION_DENIED',
      'PAYROLL_BRANCH_PERMISSION_DENIED',
      'PAYROLL_COMMISSION_PERMISSION_DENIED',
      'PAYROLL_GENERATION_PERMISSION_DENIED',
      'PAYROLL_PAYMENT_PERMISSION_DENIED',
    ],
    status: 403,
    code: 'PAYROLL_FORBIDDEN',
    publicMessage: 'No tienes permiso para completar esta operación de nómina.',
  },
  {
    tokens: [
      'PAYROLL_COMMISSION_TO_REVERSE_NOT_FOUND',
      'PAYROLL_EARNED_COMMISSION_NOT_FOUND',
      'PAYROLL_ENTRY_NOT_FOUND',
      'PAYROLL_RUN_NOT_FOUND',
    ],
    status: 404,
    code: 'PAYROLL_NOT_FOUND',
    publicMessage: 'La nómina solicitada no existe.',
  },
] as const

const FINANCE_ERROR_MAPPINGS = [
  {
    tokens: [
      'FINANCE_IDEMPOTENCY_KEY_REUSED',
      'FINANCE_RECURRING_IDEMPOTENCY_KEY_REUSED',
      'FINANCE_OVERPAYMENT',
      '23505',
    ],
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
      'FINANCE_RECURRING_PERMISSION_DENIED',
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
  const payrollMapping = PAYROLL_ERROR_MAPPINGS.find(({ tokens }) =>
    tokens.some((token) => haystack.includes(token)),
  )
  if (payrollMapping) {
    return new FinanceApiError(
      payrollMapping.publicMessage,
      payrollMapping.status,
      payrollMapping.code,
    )
  }
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
      'id, organization_id, branch_id, category_id, template_id, recurrence_period, concept, amount, paid_amount, currency, vendor, accounting_date, due_date, status, notes, void_reason, voided_at, created_at, updated_at, finance_categories(id, name, code)',
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

  const obligations = data ?? []
  const obligationIds = obligations.map((obligation) => obligation.id)
  const { data: payments, error: paymentsError } = obligationIds.length
    ? await admin
        .from('finance_payments')
        .select('id, obligation_id, payment_method, direction, reverses_payment_id')
        .eq('organization_id', organizationId)
        .in('obligation_id', obligationIds)
    : { data: [], error: null }
  if (paymentsError) throw toFinanceApiError(paymentsError)

  const reversedPaymentIds = new Set(
    (payments ?? [])
      .filter((payment) => payment.direction === 'reversal' && payment.reverses_payment_id)
      .map((payment) => payment.reverses_payment_id),
  )
  const cashPaidObligationIds = new Set(
    (payments ?? [])
      .filter((payment) =>
        payment.direction === 'payment'
        && payment.payment_method === 'cash'
        && !reversedPaymentIds.has(payment.id),
      )
      .map((payment) => payment.obligation_id),
  )

  return {
    obligations: obligations.map((obligation) => ({
      ...obligation,
      // Las obligaciones anuladas tienen saldo pendiente 0.
      outstanding_amount:
        obligation.status === 'voided'
          ? 0
          : Math.max(0, Number(obligation.amount) - Number(obligation.paid_amount)),
      requires_cash_session_on_void: cashPaidObligationIds.has(obligation.id),
    })),
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
  idempotencyKey?: string
}) {
  const { organizationId, userId, input, idempotencyKey } = params
  const admin = createAdminSupabase()
  const dueDays = daysBetween(input.accountingDate, input.dueDate)
  const category = await loadFinanceCategory(organizationId, input.categoryId)
  const concept = input.concept ?? category.name

  if (input.recurrence) {
    if (!idempotencyKey) {
      throw new FinanceApiError(
        'Las obligaciones recurrentes requieren una clave de idempotencia.',
        422,
        'FINANCE_IDEMPOTENCY_KEY_REQUIRED',
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      'create_recurring_finance_obligation_atomic',
      {
        p_organization_id: organizationId,
        p_branch_id: input.branchId,
        p_category_id: input.categoryId,
        p_concept: concept,
        p_amount: input.amount,
        p_vendor: input.vendor ?? null,
        p_notes: input.notes ?? null,
        p_frequency: input.recurrence.frequency,
        p_starts_on: input.recurrence.startsOn,
        p_ends_on: input.recurrence.endsOn ?? null,
        p_due_days_after_accounting: dueDays,
        p_idempotency_key: idempotencyKey,
      },
    )

    if (error) throw toFinanceApiError(error)
    return (data as { obligation?: unknown } | null)?.obligation ?? data
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
      template_id: null,
      recurrence_period: null,
      concept,
      amount: input.amount,
      currency: 'PYG',
      vendor: input.vendor ?? null,
      accounting_date: input.accountingDate,
      due_date: input.dueDate ?? null,
      status,
      notes: input.notes ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select('*, finance_categories(id, name, code)')
    .single()

  if (error || !data) throw toFinanceApiError(error)

  return {
    ...data,
    outstanding_amount: Number(data.amount),
    requires_cash_session_on_void: false,
  }
}

export type ExpenseUpdateInput = Partial<
  Omit<ExpenseInput, 'branchId' | 'recurrence' | 'dueDate' | 'vendor' | 'notes'>
> & {
  branchId: string
  dueDate?: string | null
  vendor?: string | null
  notes?: string | null
}

type CurrentUnpaidObligation = {
  category_id: string
  concept: string
  amount: number
  vendor: string | null
  accounting_date: string
  due_date: string | null
  notes: string | null
}

export function buildUnpaidObligationUpdate(
  current: CurrentUnpaidObligation,
  input: ExpenseUpdateInput,
  today: string,
) {
  const effectiveDueDate =
    input.dueDate === undefined ? current.due_date : input.dueDate

  return {
    ...(input.categoryId === undefined ? {} : { category_id: input.categoryId }),
    ...(input.concept === undefined ? {} : { concept: input.concept }),
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    ...(input.vendor === undefined ? {} : { vendor: input.vendor }),
    ...(input.accountingDate === undefined
      ? {}
      : { accounting_date: input.accountingDate }),
    ...(input.dueDate === undefined ? {} : { due_date: input.dueDate }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    status: effectiveDueDate && effectiveDueDate < today ? 'overdue' : 'pending',
  }
}

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
  const dueDate =
    input.dueDate === undefined
      ? current.due_date ?? undefined
      : input.dueDate ?? undefined
  daysBetween(accountingDate, dueDate)

  const update = {
    ...buildUnpaidObligationUpdate(
      current as CurrentUnpaidObligation,
      input,
      new Date().toISOString().slice(0, 10),
    ),
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

export async function assertFinanceEmployeeMembership(params: {
  organizationId: string
  employeeId: string
}) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', params.organizationId)
    .eq('user_id', params.employeeId)
    .neq('role', 'customer')
    .maybeSingle()

  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError(
      'El empleado no pertenece a la organización.',
      422,
      'PAYROLL_EMPLOYEE_INVALID',
    )
  }

  return data as { user_id: string; role: string; status: string }
}

export async function listFinanceEmployees(organizationId: string) {
  const admin = createAdminSupabase()
  const { data: members, error } = await admin
    .from('organization_members')
    .select('user_id, role, status, created_at')
    .eq('organization_id', organizationId)
    .neq('role', 'customer')
    .order('created_at', { ascending: true })

  if (error) throw toFinanceApiError(error)
  if (!members?.length) return []

  const userIds = members.map((m) => m.user_id)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  return members.map((m) => {
    const profile = profileMap.get(m.user_id)
    return {
      ...m,
      display_name: profile?.full_name || profile?.email || m.user_id,
    }
  })
}

export async function listEmployeeCompensation(
  organizationId: string,
  employeeId?: string,
) {
  const admin = createAdminSupabase()
  let query = admin
    .from('employee_compensation')
    .select('id, organization_id, employee_id, base_salary, pay_frequency, effective_from, effective_to, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('effective_from', { ascending: false })

  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query
  if (error) throw toFinanceApiError(error)
  return data ?? []
}

export async function createEmployeeCompensation(params: {
  organizationId: string
  userId: string
  input: CompensationInput
}) {
  await assertFinanceEmployeeMembership({
    organizationId: params.organizationId,
    employeeId: params.input.employeeId,
  })
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('employee_compensation')
    .insert({
      organization_id: params.organizationId,
      employee_id: params.input.employeeId,
      base_salary: params.input.baseSalary,
      pay_frequency: 'monthly',
      effective_from: params.input.effectiveFrom,
      effective_to: params.input.effectiveTo ?? null,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (error || !data) throw toFinanceApiError(error)
  return data
}

export async function updateEmployeeCompensation(params: {
  organizationId: string
  userId: string
  id: string
  input: CompensationInput
}) {
  await assertFinanceEmployeeMembership({
    organizationId: params.organizationId,
    employeeId: params.input.employeeId,
  })
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('employee_compensation')
    .update({
      employee_id: params.input.employeeId,
      base_salary: params.input.baseSalary,
      effective_from: params.input.effectiveFrom,
      effective_to: params.input.effectiveTo ?? null,
    })
    .eq('organization_id', params.organizationId)
    .eq('id', params.id)
    .select('*')
    .maybeSingle()

  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError('La compensación no existe.', 404, 'PAYROLL_COMPENSATION_NOT_FOUND')
  }
  return data
}

export async function deleteEmployeeCompensation(params: {
  organizationId: string
  id: string
}) {
  const admin = createAdminSupabase()
  const { error, count } = await admin
    .from('employee_compensation')
    .delete({ count: 'exact' })
    .eq('organization_id', params.organizationId)
    .eq('id', params.id)

  if (error) throw toFinanceApiError(error)
  if (!count) {
    throw new FinanceApiError('La compensación no existe.', 404, 'PAYROLL_COMPENSATION_NOT_FOUND')
  }
}

export async function listCommissionRules(
  organizationId: string,
  filters: { employeeId?: string; branchId?: string },
) {
  const admin = createAdminSupabase()
  let query = admin
    .from('commission_rules')
    .select('id, organization_id, branch_id, scope_type, role, employee_id, source_type, source_reference_id, accrual_status, calculation_type, value, status, effective_from, effective_to, approved_by, approved_at, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('effective_from', { ascending: false })

  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  const { data, error } = await query
  if (error) throw toFinanceApiError(error)
  return data ?? []
}

function commissionRuleRecord(
  organizationId: string,
  userId: string,
  input: CommissionRuleInput,
) {
  return {
    organization_id: organizationId,
    branch_id: input.branchId ?? null,
    scope_type: input.scopeType,
    role: input.scopeType === 'role' ? input.role ?? null : null,
    employee_id: input.scopeType === 'employee' ? input.employeeId ?? null : null,
    source_type: input.sourceType,
    source_reference_id:
      input.sourceType === 'product' || input.sourceType === 'category'
        ? input.sourceReferenceId ?? null
        : null,
    accrual_status:
      input.sourceType === 'repair' || input.sourceType === 'repair_labor'
        ? input.accrualStatus ?? null
        : null,
    calculation_type: input.calculationType,
    value: input.value,
    status: input.status,
    effective_from: input.effectiveFrom,
    effective_to: input.effectiveTo ?? null,
    approved_by: input.status === 'approved' ? userId : null,
    approved_at: input.status === 'approved' ? new Date().toISOString() : null,
    created_by: userId,
  }
}

export async function createCommissionRule(params: {
  organizationId: string
  userId: string
  input: CommissionRuleInput
}) {
  if (params.input.employeeId) {
    await assertFinanceEmployeeMembership({
      organizationId: params.organizationId,
      employeeId: params.input.employeeId,
    })
  }
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('commission_rules')
    .insert(commissionRuleRecord(params.organizationId, params.userId, params.input))
    .select('*')
    .single()

  if (error || !data) throw toFinanceApiError(error)
  return data
}

export async function updateCommissionRule(params: {
  organizationId: string
  userId: string
  id: string
  input: CommissionRuleInput
}) {
  if (params.input.employeeId) {
    await assertFinanceEmployeeMembership({
      organizationId: params.organizationId,
      employeeId: params.input.employeeId,
    })
  }
  const record = commissionRuleRecord(
    params.organizationId,
    params.userId,
    params.input,
  )
  delete record.created_by
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('commission_rules')
    .update(record)
    .eq('organization_id', params.organizationId)
    .eq('id', params.id)
    .select('*')
    .maybeSingle()

  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError('La regla de comisión no existe.', 404, 'PAYROLL_RULE_NOT_FOUND')
  }
  return data
}

export async function deleteCommissionRule(params: {
  organizationId: string
  id: string
}) {
  const admin = createAdminSupabase()
  const { error, count } = await admin
    .from('commission_rules')
    .delete({ count: 'exact' })
    .eq('organization_id', params.organizationId)
    .eq('id', params.id)

  if (error) throw toFinanceApiError(error)
  if (!count) {
    throw new FinanceApiError('La regla de comisión no existe.', 404, 'PAYROLL_RULE_NOT_FOUND')
  }
}

export async function getCommissionRuleBranch(
  organizationId: string,
  commissionRuleId: string,
) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('commission_rules')
    .select('id, branch_id')
    .eq('organization_id', organizationId)
    .eq('id', commissionRuleId)
    .maybeSingle()
  if (error) throw toFinanceApiError(error)
  if (!data) {
    throw new FinanceApiError('La regla de comisión no existe.', 404, 'PAYROLL_RULE_NOT_FOUND')
  }
  return data as { id: string; branch_id: string | null }
}

type PayrollPreviewInput = PayrollGenerationInput

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function daysInMonth(date: string) {
  const [year, month] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function eachDay(periodFrom: string, periodTo: string) {
  const days: string[] = []
  const cursor = new Date(`${periodFrom}T00:00:00Z`)
  const end = new Date(`${periodTo}T00:00:00Z`)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/**
 * Preview eligibility is deliberately derived from the payroll period, not the
 * member's current role. A former/current customer membership can still have
 * an eligible historical employment event in the requested period.
 */
export function shouldIncludePayrollPreviewMember(input: {
  currentMembershipRole: string
  hasActiveEmployment: boolean
  receivesSalaryAtBranch: boolean
  hasUnclaimedCommission: boolean
}) {
  return (
    input.hasUnclaimedCommission ||
    (input.hasActiveEmployment && input.receivesSalaryAtBranch)
  )
}

export async function getPayrollPreview(
  organizationId: string,
  input: PayrollPreviewInput,
) {
  const admin = createAdminSupabase()
  const payrollClient = await createClient()
  const { error: materializationError } = await payrollClient.rpc(
    'calculate_earned_commissions',
    {
      p_organization_id: organizationId,
      p_period_from: input.periodFrom,
      p_period_to: input.periodTo,
      p_branch_id: input.branchId ?? null,
    },
  )
  if (materializationError) throw toFinanceApiError(materializationError)

  let commissionsQuery = admin
    .from('earned_commissions')
    .select('id, employee_id, employee_role, amount, occurred_on, created_at')
    .eq('organization_id', organizationId)
    .lte('occurred_on', input.periodTo)
  if (input.branchId) commissionsQuery = commissionsQuery.eq('branch_id', input.branchId)

  let assignmentsQuery = admin
    .from('user_branch_assignments')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('is_primary', true)
  if (input.branchId) assignmentsQuery = assignmentsQuery.eq('branch_id', input.branchId)

  const [
    membersResult,
    compensationResult,
    commissionsResult,
    claimedResult,
    employmentResult,
    assignmentsResult,
    runsResult,
    settingsResult,
  ] = await Promise.all([
    admin
      .from('organization_members')
      .select('user_id, role, status')
      .eq('organization_id', organizationId),
    admin
      .from('employee_compensation')
      .select('id, employee_id, base_salary, effective_from, effective_to, legacy_cutover_on')
      .eq('organization_id', organizationId)
      .lte('effective_from', input.periodTo),
    commissionsQuery,
    admin
      .from('payroll_entry_commissions')
      .select('earned_commission_id')
      .eq('organization_id', organizationId),
    admin
      .from('employee_employment_events')
      .select('id, employee_id, employee_role, employment_status, occurred_at')
      .eq('organization_id', organizationId),
    assignmentsQuery,
    admin
      .from('payroll_runs')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('run_type', 'standard')
      .in('status', ['draft', 'approved'])
      .lte('period_from', input.periodTo)
      .gte('period_to', input.periodFrom),
    admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ])
  if (membersResult.error) throw toFinanceApiError(membersResult.error)
  if (compensationResult.error) throw toFinanceApiError(compensationResult.error)
  if (commissionsResult.error) throw toFinanceApiError(commissionsResult.error)
  if (claimedResult.error) throw toFinanceApiError(claimedResult.error)
  if (employmentResult.error) throw toFinanceApiError(employmentResult.error)
  if (assignmentsResult.error) throw toFinanceApiError(assignmentsResult.error)
  if (runsResult.error) throw toFinanceApiError(runsResult.error)
  if (settingsResult.error) throw toFinanceApiError(settingsResult.error)

  const conflictingRunIds = (runsResult.data ?? []).map((run) => run.id)
  const entriesResult = conflictingRunIds.length
    ? await admin
        .from('payroll_entries')
        .select('employee_id, base_amount')
        .eq('organization_id', organizationId)
        .in('payroll_run_id', conflictingRunIds)
    : { data: [], error: null }
  if (entriesResult.error) throw toFinanceApiError(entriesResult.error)

  const staff = membersResult.data ?? []
  const compensation = compensationResult.data ?? []
  const claimedCommissionIds = new Set(
    (claimedResult.data ?? []).map((record) => record.earned_commission_id),
  )
  const commissions = (commissionsResult.data ?? []).filter(
    (record) => !claimedCommissionIds.has(record.id),
  )
  const payrollDays = eachDay(input.periodFrom, input.periodTo)
  const timezone = settingsResult.data?.timezone ?? 'America/Asuncion'
  const payrollDayForEvent = (occurredAt: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(occurredAt))
    const value = (type: string) => parts.find((part) => part.type === type)?.value
    return `${value('year')}-${value('month')}-${value('day')}`
  }
  const employmentByEmployee = new Map<string, typeof employmentResult.data>()
  for (const event of employmentResult.data ?? []) {
    const events = employmentByEmployee.get(event.employee_id) ?? []
    events.push(event)
    employmentByEmployee.set(event.employee_id, events)
  }
  for (const events of employmentByEmployee.values()) {
    events.sort((left, right) =>
      left.occurred_at === right.occurred_at
        ? left.id.localeCompare(right.id)
        : left.occurred_at.localeCompare(right.occurred_at),
    )
  }
  const branchSalaryEmployees = new Set(
    (assignmentsResult.data ?? []).map((assignment) => assignment.user_id),
  )
  const salaryConflictEmployees = new Set(
    (entriesResult.data ?? [])
      .filter((entry) => Number(entry.base_amount) > 0)
      .map((entry) => entry.employee_id),
  )
  const commissionByEmployee = new Map<string, typeof commissions>()
  for (const commission of commissions) {
    const employeeCommissions = commissionByEmployee.get(commission.employee_id) ?? []
    employeeCommissions.push(commission)
    commissionByEmployee.set(commission.employee_id, employeeCommissions)
  }
  const entries = staff.flatMap((member) => {
    const employeeEvents = employmentByEmployee.get(member.user_id) ?? []
    const employmentForDay = (payDay: string) => {
      const eligible = employeeEvents.filter(
        (event) => payrollDayForEvent(event.occurred_at) <= payDay,
      )
      return eligible[eligible.length - 1]
    }
    const activeEvents = payrollDays
      .map(employmentForDay)
      .filter(
        (event) =>
          event?.employment_status === 'active' && event.employee_role !== 'customer',
      )
    const hasActiveEmployment = activeEvents.length > 0
    const receivesSalaryAtBranch =
      !input.branchId || branchSalaryEmployees.has(member.user_id)
    const hasUnclaimedCommission = commissionByEmployee.has(member.user_id)
    if (!shouldIncludePayrollPreviewMember({
      currentMembershipRole: member.role,
      hasActiveEmployment,
      receivesSalaryAtBranch,
      hasUnclaimedCommission,
    })) {
      return []
    }

    const employeeCompensation = compensation.filter(
      (record) => record.employee_id === member.user_id,
    )
    const salaryEligible =
      hasActiveEmployment &&
      receivesSalaryAtBranch &&
      !salaryConflictEmployees.has(member.user_id)
    const salary = payrollDays.reduce((total, payDay) => {
      const record = employeeCompensation
        .filter(
          (candidate) =>
            candidate.effective_from <= payDay &&
            payDay >= (candidate.legacy_cutover_on ?? candidate.effective_from) &&
            (!candidate.effective_to || candidate.effective_to >= payDay),
        )
        .sort((left, right) =>
          left.effective_from === right.effective_from
            ? right.id.localeCompare(left.id)
            : right.effective_from.localeCompare(left.effective_from),
        )[0]
      const employment = employmentForDay(payDay)
      const isActive =
        employment?.employment_status === 'active' &&
        employment.employee_role !== 'customer'
      return total +
        (salaryEligible && isActive && record
          ? Number(record.base_salary) / daysInMonth(payDay)
          : 0)
    }, 0)
    const commission = (commissionByEmployee.get(member.user_id) ?? [])
      .reduce((total, record) => total + Number(record.amount), 0)
    const bonuses = 0
    const discounts = 0
    const advances = 0
    const grossPay = roundMoney(salary + commission + bonuses)
    const netPay = roundMoney(grossPay + discounts + advances)

    return {
      employeeId: member.user_id,
      role: activeEvents[activeEvents.length - 1]?.employee_role ??
        (commissionByEmployee.get(member.user_id) ?? [])
          .sort((left, right) =>
            left.occurred_on === right.occurred_on
              ? right.created_at.localeCompare(left.created_at)
              : right.occurred_on.localeCompare(left.occurred_on),
          )[0]?.employee_role ??
        member.role,
      salary: roundMoney(salary),
      earnedCommissions: roundMoney(commission),
      bonuses,
      discounts,
      advances,
      grossPay,
      netPay,
    }
  })

  return {
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    branchId: input.branchId ?? null,
    entries,
    totals: entries.reduce(
      (totals, entry) => ({
        salary: roundMoney(totals.salary + entry.salary),
        earnedCommissions: roundMoney(totals.earnedCommissions + entry.earnedCommissions),
        bonuses: roundMoney(totals.bonuses + entry.bonuses),
        discounts: roundMoney(totals.discounts + entry.discounts),
        advances: roundMoney(totals.advances + entry.advances),
        grossPay: roundMoney(totals.grossPay + entry.grossPay),
        netPay: roundMoney(totals.netPay + entry.netPay),
      }),
      { salary: 0, earnedCommissions: 0, bonuses: 0, discounts: 0, advances: 0, grossPay: 0, netPay: 0 },
    ),
  }
}

export async function generatePayrollRun(params: {
  organizationId: string
  input: PayrollGenerationInput
  idempotencyKey: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_payroll_run_atomic', {
    p_organization_id: params.organizationId,
    p_period_from: params.input.periodFrom,
    p_period_to: params.input.periodTo,
    p_idempotency_key: params.idempotencyKey,
    p_branch_id: params.input.branchId ?? null,
  })
  if (error) throw toFinanceApiError(error)
  return data
}

export async function approvePayrollRun(params: {
  rpcName: 'approve_payroll_run_atomic'
  organizationId: string
  payrollRunId: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(params.rpcName, {
    p_organization_id: params.organizationId,
    p_payroll_run_id: params.payrollRunId,
  })
  if (error) throw toFinanceApiError(error)
  return data
}

export async function getPayrollRunBranch(
  organizationId: string,
  payrollRunId: string,
) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('payroll_runs')
    .select('id, branch_id, status')
    .eq('organization_id', organizationId)
    .eq('id', payrollRunId)
    .maybeSingle()
  if (error) throw toFinanceApiError(error)
  if (!data) throw new FinanceApiError('La nómina no existe.', 404, 'PAYROLL_RUN_NOT_FOUND')
  return data as { id: string; branch_id: string | null; status: string }
}

export async function listPayrollRuns(
  organizationId: string,
  filters: { branchId?: string; periodFrom?: string; periodTo?: string },
) {
  const admin = createAdminSupabase()
  let runsQuery = admin
    .from('payroll_runs')
    .select('id, branch_id, period_from, period_to, status, net_amount, generated_at')
    .eq('organization_id', organizationId)
    .order('generated_at', { ascending: false })
    .limit(25)
  if (filters.branchId) runsQuery = runsQuery.eq('branch_id', filters.branchId)
  if (filters.periodFrom) runsQuery = runsQuery.gte('period_to', filters.periodFrom)
  if (filters.periodTo) runsQuery = runsQuery.lte('period_from', filters.periodTo)
  const { data: runs, error: runsError } = await runsQuery
  if (runsError) throw toFinanceApiError(runsError)

  const runIds = (runs ?? []).map((run) => run.id)
  const { data: entries, error: entriesError } = runIds.length
    ? await admin
        .from('payroll_entries')
        .select('id, payroll_run_id, employee_id, employee_role, base_amount, commission_amount, adjustment_amount, gross_amount, net_amount, paid_amount, payment_status')
        .eq('organization_id', organizationId)
        .in('payroll_run_id', runIds)
    : { data: [], error: null }
  if (entriesError) throw toFinanceApiError(entriesError)

  const employeeIds = [...new Set((entries ?? []).map((e) => e.employee_id))]
  const { data: profiles } = employeeIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', employeeIds)
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  return (runs ?? []).map((run) => ({
    ...run,
    entries: (entries ?? [])
      .filter((entry) => entry.payroll_run_id === run.id)
      .map((entry) => {
        const profile = profileMap.get(entry.employee_id)
        return {
          ...entry,
          base_amount: Number(entry.base_amount) || 0,
          commission_amount: Number(entry.commission_amount) || 0,
          adjustment_amount: Number(entry.adjustment_amount) || 0,
          gross_amount: Number(entry.gross_amount) || 0,
          outstanding_amount: Math.max(0, Number(entry.net_amount) - Number(entry.paid_amount)),
          employee_display_name: profile?.full_name || profile?.email || entry.employee_id,
        }
      }),
  }))
}

export async function getPayrollEntryCommissions(
  organizationId: string,
  payrollEntryId: string,
) {
  const admin = createAdminSupabase()
  const { data: entry, error: entryError } = await admin
    .from('payroll_entries')
    .select('id, payroll_run_id, employee_id, employee_role, base_amount, commission_amount, adjustment_amount, gross_amount, net_amount, paid_amount, payment_status, payroll_runs(period_from, period_to, status)')
    .eq('organization_id', organizationId)
    .eq('id', payrollEntryId)
    .maybeSingle()

  if (entryError) throw toFinanceApiError(entryError)
  if (!entry) throw new FinanceApiError('Entrada de nómina no encontrada.', 404, 'NOT_FOUND')

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', entry.employee_id)
    .maybeSingle()

  // Buscar comisiones bloqueadas a esta entrada o asociadas al período
  const { data: linkedCommissions } = await admin
    .from('payroll_entry_commissions')
    .select('earned_commission_id')
    .eq('organization_id', organizationId)
    .eq('payroll_entry_id', payrollEntryId)

  const linkedIds = (linkedCommissions ?? []).map((lc) => lc.earned_commission_id)

  let commissionsQuery = admin
    .from('earned_commissions')
    .select('id, employee_id, employee_role, source_type, origin_type, origin_id, origin_key, occurred_on, basis_amount, amount, rule_snapshot, created_at')
    .eq('organization_id', organizationId)
    .eq('employee_id', entry.employee_id)

  if (linkedIds.length > 0) {
    commissionsQuery = commissionsQuery.in('id', linkedIds)
  } else {
    const run = Array.isArray(entry.payroll_runs) ? entry.payroll_runs[0] : entry.payroll_runs
    if (run?.period_from && run?.period_to) {
      commissionsQuery = commissionsQuery
        .gte('occurred_on', run.period_from)
        .lte('occurred_on', run.period_to)
    }
  }

  const { data: earnedList, error: earnedError } = await commissionsQuery.order('occurred_on', { ascending: false })
  if (earnedError) throw toFinanceApiError(earnedError)

  const commissions = earnedList ?? []
  const saleIds = commissions
    .filter((c) => c.source_type === 'sale' || c.source_type === 'product' || c.source_type === 'category' || c.origin_type === 'sale' || c.origin_type === 'sale_item')
    .map((c) => c.origin_id)

  const repairIds = commissions
    .filter((c) => c.source_type === 'repair' || c.source_type === 'repair_labor' || c.origin_type === 'repair')
    .map((c) => c.origin_id)

  // Contexto de ventas
  const { data: salesData } = saleIds.length
    ? await admin.from('sales').select('id, code, total_amount, created_at').in('id', saleIds)
    : { data: [] }
  const salesMap = new Map((salesData ?? []).map((s) => [s.id, s]))

  // Contexto de productos en ventas
  const { data: saleItemsAttribution } = saleIds.length
    ? await admin.from('commission_sale_item_attributions').select('sale_item_id, sale_id, product_id, quantity, subtotal').in('sale_id', saleIds)
    : { data: [] }
  const productIds = (saleItemsAttribution ?? []).map((sia) => sia.product_id).filter(Boolean) as string[]

  const { data: productsData } = productIds.length
    ? await admin.from('products').select('id, name, sku').in('id', productIds)
    : { data: [] }
  const productsMap = new Map((productsData ?? []).map((p) => [p.id, p]))

  // Contexto de reparaciones
  const { data: repairsData } = repairIds.length
    ? await admin.from('repairs').select('id, ticket_number, device_brand, device_model, final_cost, estimated_cost, created_at').in('id', repairIds)
    : { data: [] }
  const repairsMap = new Map((repairsData ?? []).map((r) => [r.id, r]))

  const items = commissions.map((c) => {
    let referenceCode = ''
    let title = ''
    let details = ''

    const rule = (c.rule_snapshot as Record<string, unknown>) ?? {}
    const ruleCalcType = rule.calculation_type === 'fixed' ? 'fixed' : 'percentage'
    const ruleValue = Number(rule.value) || 0
    const ruleExplanation =
      ruleCalcType === 'percentage'
        ? `${ruleValue}% sobre importe base`
        : `Gs. ${Math.round(ruleValue).toLocaleString('es-PY')} fijo por operación`

    if (c.source_type === 'repair' || c.source_type === 'repair_labor' || c.origin_type === 'repair') {
      const rep = repairsMap.get(c.origin_id)
      referenceCode = rep?.ticket_number ? `#REP-${rep.ticket_number}` : 'Reparación'
      const device = [rep?.device_brand, rep?.device_model].filter(Boolean).join(' ')
      title = device ? `Reparación: ${device}` : 'Servicio Técnico / Reparación'
      details = c.source_type === 'repair_labor' ? 'Mano de obra técnica completada' : 'Reparación completada'
    } else {
      const sale = salesMap.get(c.origin_id)
      referenceCode = sale?.code ? `Venta ${sale.code}` : 'Venta'
      const sia = (saleItemsAttribution ?? []).find((a) => a.sale_id === c.origin_id)
      const prod = sia?.product_id ? productsMap.get(sia.product_id) : null

      if (prod) {
        title = prod.name
        details = `Venta de producto (${Number(sia?.quantity) || 1} un.)`
      } else {
        title = referenceCode
        details = 'Comisión por venta comercial'
      }
    }

    return {
      id: c.id,
      sourceType: c.source_type,
      originType: c.origin_type,
      occurredOn: c.occurred_on,
      referenceCode,
      title,
      details,
      basisAmount: Number(c.basis_amount) || 0,
      commissionAmount: Number(c.amount) || 0,
      ruleSnapshot: {
        calculationType: ruleCalcType,
        value: ruleValue,
        explanation: ruleExplanation,
      },
    }
  })

  return {
    entry: {
      id: entry.id,
      employeeId: entry.employee_id,
      employeeDisplayName: profile?.full_name || profile?.email || entry.employee_id,
      employeeRole: entry.employee_role,
      baseAmount: Number(entry.base_amount) || 0,
      commissionAmount: Number(entry.commission_amount) || 0,
      adjustmentAmount: Number(entry.adjustment_amount) || 0,
      grossAmount: Number(entry.gross_amount) || 0,
      netAmount: Number(entry.net_amount) || 0,
      paidAmount: Number(entry.paid_amount) || 0,
      outstandingAmount: Math.max(0, Number(entry.net_amount) - Number(entry.paid_amount)),
      paymentStatus: entry.payment_status,
    },
    commissions: items,
  }
}

export async function getPayrollEntryBranch(
  organizationId: string,
  payrollEntryId: string,
) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('payroll_entries')
    .select('id, branch_id, payroll_run_id')
    .eq('organization_id', organizationId)
    .eq('id', payrollEntryId)
    .maybeSingle()
  if (error) throw toFinanceApiError(error)
  if (!data) throw new FinanceApiError('La entrada de nómina no existe.', 404, 'PAYROLL_ENTRY_NOT_FOUND')
  const entry = data as { id: string; branch_id: string | null; payroll_run_id: string }
  const run = await getPayrollRunBranch(organizationId, entry.payroll_run_id)
  if (entry.branch_id !== run.branch_id) {
    throw new FinanceApiError(
      'La entrada de nómina no coincide con el alcance de su corrida.',
      422,
      'PAYROLL_ENTRY_SCOPE_MISMATCH',
    )
  }
  return entry
}

export async function createPayrollAdjustment(params: {
  organizationId: string
  userId: string
  input: PayrollAdjustmentInput
  idempotencyKey: string
}) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('payroll_adjustments')
    .insert({
      organization_id: params.organizationId,
      payroll_entry_id: params.input.payrollEntryId,
      adjustment_type: params.input.adjustmentType,
      amount: params.input.amount,
      reason: params.input.reason,
      idempotency_key: params.idempotencyKey,
      reverses_adjustment_id: params.input.reversesAdjustmentId ?? null,
      created_by: params.userId,
    })
    .select('*')
    .single()
  if (error || !data) throw toFinanceApiError(error)
  return data
}

export async function payPayrollEntry(params: {
  rpcName: 'pay_payroll_entry_atomic'
  organizationId: string
  payrollEntryId: string
  input: PayrollPaymentInput
  branchId: string | null
  idempotencyKey: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(params.rpcName, {
    p_organization_id: params.organizationId,
    p_branch_id: params.branchId,
    p_payroll_entry_id: params.payrollEntryId,
    p_amount: params.input.amount,
    p_payment_method: params.input.paymentMethod,
    p_payment_date: params.input.paymentDate,
    p_idempotency_key: params.idempotencyKey,
    p_cash_session_id: params.input.cashSessionId ?? null,
    p_reference: params.input.reference ?? null,
    p_notes: params.input.notes ?? null,
  })
  if (error) throw toFinanceApiError(error)
  return data
}

const financeReportDateSchema = z.iso.date()
const financeReportIdSchema = z.uuid()

export const financeSummaryQuerySchema = z
  .object({
    organizationId: financeReportIdSchema.optional(),
    organizationHeader: financeReportIdSchema.optional(),
    startDate: financeReportDateSchema,
    endDate: financeReportDateSchema,
    branchId: financeReportIdSchema.optional(),
  })
  .refine(
    (input) =>
      !input.organizationId ||
      !input.organizationHeader ||
      input.organizationId === input.organizationHeader,
    { message: 'Los selectores de organizacion no coinciden.' },
  )
  .refine((input) => input.startDate <= input.endDate, {
    message: 'El rango financiero es invalido.',
    path: ['endDate'],
  })

export type FinanceSummaryQuery = z.infer<typeof financeSummaryQuerySchema>

type FinanceSaleRecord = {
  id: string
  code?: string | null
  branchId: string | null
  createdAt: string
  status: string | null
  totalAmount: number
  paidAmount: number
  employeeId?: string | null
}

type FinanceSaleItemRecord = {
  saleId: string
  productId?: string | null
  productName?: string | null
  quantity: number
  unitCost: number | null
  revenueAmount?: number | null
}

type FinanceSalePaymentRecord = {
  saleId: string
  branchId: string | null
  paymentDate: string
  paymentMethod: string
  status: string
  amount: number
}

type FinanceRepairRecord = {
  id: string
  ticketNumber?: string | null
  branchId: string | null
  createdAt: string
  status: string | null
  revenueAmount: number
  paidAmount: number
  employeeId?: string | null
}

type FinanceRepairPartRecord = {
  repairId: string
  quantity: number
  unitCost: number | null
  status?: string | null
}

type FinanceObligationRecord = {
  id: string
  branchId: string | null
  accountingDate: string
  dueDate: string | null
  status: string
  amount: number
}

type FinancePayrollEntryRecord = {
  id: string
  branchId: string | null
  approvedAt: string | null
  status: string
  netAmount: number
  employeeId?: string | null
}

type FinancePaymentRecord = {
  branchId: string | null
  paymentDate: string
  direction: 'payment' | 'reversal'
  amount: number
}

export interface FinanceSummaryRecords {
  sales: FinanceSaleRecord[]
  saleItems: FinanceSaleItemRecord[]
  salePayments?: FinanceSalePaymentRecord[]
  creditPayments?: FinanceSalePaymentRecord[]
  salePaymentTimingAvailable?: boolean
  creditPaymentTimingAvailable?: boolean
  repairs: FinanceRepairRecord[]
  repairParts: FinanceRepairPartRecord[]
  obligations: FinanceObligationRecord[]
  payrollEntries: FinancePayrollEntryRecord[]
  financePayments: FinancePaymentRecord[]
  payrollPayments: FinancePaymentRecord[]
}

export interface FinanceSummaryReport extends FinanceSummary {
  generatedAt: string
  filters: FinanceFilters
  comparison: FinanceSummary
  upcomingDue: Array<{ id: string; dueDate: string; amount: number }>
  overdue: Array<{ id: string; dueDate: string; amount: number }>
}

export type FinanceProfitabilityGroup =
  | 'sale'
  | 'repair'
  | 'product'
  | 'employee'
  | 'branch'

export interface FinanceProfitabilityRow {
  id: string
  label: string
  group: FinanceProfitabilityGroup
  revenue: number
  directCosts: number | null
  grossProfit: number | null
  complete: boolean
}

const FINANCE_REPORT_QUERY_LIMIT = 10_000

function money(value: number | string | null | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoneyValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function day(value: string | null | undefined): string | null {
  if (!value) return null
  const result = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null
}

function isInPeriod(value: string | null | undefined, filters: FinanceFilters): boolean {
  const valueDay = day(value)
  return Boolean(valueDay && valueDay >= filters.startDate && valueDay <= filters.endDate)
}

function isInBranch(branchId: string | null, filters: FinanceFilters): boolean {
  return !filters.branchId || branchId === filters.branchId
}

function previousPeriod(filters: FinanceFilters): FinanceFilters {
  const start = new Date(`${filters.startDate}T00:00:00Z`)
  const end = new Date(`${filters.endDate}T00:00:00Z`)
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  const previousEnd = new Date(start)
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1)

  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
    branchId: filters.branchId,
  }
}

function isCancelledRepair(status: string | null): boolean {
  return String(status ?? '').trim().toLowerCase() === 'cancelado'
}

function isUsedRepairPart(status: string | null | undefined): boolean {
  return ['installed', 'used', 'consumed'].includes(
    String(status ?? '').trim().toLowerCase(),
  )
}

function isCompletedNonCreditSalePayment(payment: FinanceSalePaymentRecord): boolean {
  return (
    payment.status === 'completed' &&
    ['cash', 'card', 'transfer'].includes(payment.paymentMethod)
  )
}

function signedPayments(
  payments: FinancePaymentRecord[],
  filters: FinanceFilters,
): number {
  return payments
    .filter(
      (payment) =>
        isInBranch(payment.branchId, filters) &&
        isInPeriod(payment.paymentDate, filters),
    )
    .reduce(
      (total, payment) =>
        total + (payment.direction === 'reversal' ? -money(payment.amount) : money(payment.amount)),
      0,
    )
}

function buildFinancialSummary(
  records: FinanceSummaryRecords,
  filters: FinanceFilters,
): FinanceSummary {
  const saleItemsBySaleId = new Map<string, FinanceSaleItemRecord[]>()
  for (const item of records.saleItems) {
    const items = saleItemsBySaleId.get(item.saleId) ?? []
    items.push(item)
    saleItemsBySaleId.set(item.saleId, items)
  }
  const partsByRepairId = new Map<string, FinanceRepairPartRecord[]>()
  for (const part of records.repairParts) {
    const parts = partsByRepairId.get(part.repairId) ?? []
    parts.push(part)
    partsByRepairId.set(part.repairId, parts)
  }

  const selectedSales = records.sales.filter(
    (sale) =>
      isInBranch(sale.branchId, filters) &&
      isInPeriod(sale.createdAt, filters) &&
      isCompletedSaleStatus(sale.status),
  )
  const selectedRepairs = records.repairs.filter(
    (repair) =>
      isInBranch(repair.branchId, filters) &&
      isInPeriod(repair.createdAt, filters) &&
      !isCancelledRepair(repair.status),
  )
  const usedPartsByRepairId = new Map<string, FinanceRepairPartRecord[]>()
  for (const [repairId, parts] of partsByRepairId) {
    usedPartsByRepairId.set(
      repairId,
      parts.filter((part) => isUsedRepairPart(part.status)),
    )
  }
  const revenue = [
    ...selectedSales.map((sale) => {
      const items = saleItemsBySaleId.get(sale.id) ?? []
      const hasCost = items.length > 0 && items.every((item) => item.unitCost !== null)
      return {
        id: sale.id,
        amount: money(sale.totalAmount),
        cashAmount: 0,
        hasCost,
      }
    }),
    ...selectedRepairs.map((repair) => {
      const parts = usedPartsByRepairId.get(repair.id) ?? []
      return {
        id: repair.id,
        amount: money(repair.revenueAmount),
        cashAmount: 0,
        hasCost: parts.every((part) => part.unitCost !== null),
      }
    }),
  ]
  const directCosts = [
    ...selectedSales.flatMap((sale) =>
      (saleItemsBySaleId.get(sale.id) ?? []).flatMap((item) =>
        item.unitCost === null
          ? []
          : [{ id: `${sale.id}:${item.productId ?? item.productName ?? 'item'}`, amount: money(item.quantity) * money(item.unitCost), paidAmount: 0 }],
      ),
    ),
    ...selectedRepairs.flatMap((repair) =>
      (usedPartsByRepairId.get(repair.id) ?? []).flatMap((part) =>
        part.unitCost === null
          ? []
          : [{ id: `${repair.id}:part`, amount: money(part.quantity) * money(part.unitCost), paidAmount: 0 }],
      ),
    ),
  ]
  const expenses = records.obligations
    .filter(
      (obligation) =>
        isInBranch(obligation.branchId, filters) &&
        isInPeriod(obligation.accountingDate, filters) &&
        obligation.status !== 'voided',
    )
    .map((obligation) => ({ id: obligation.id, amount: money(obligation.amount), paidAmount: 0 }))
  const payroll = records.payrollEntries
    .filter(
      (entry) =>
        isInBranch(entry.branchId, filters) &&
        entry.status === 'approved' &&
        isInPeriod(entry.approvedAt, filters),
    )
    .map((entry) => ({ id: entry.id, amount: money(entry.netAmount), paidAmount: 0 }))
  const summary = calculateFinancialSummary({ revenue, directCosts, expenses, payroll })
  const saleCollected = [...(records.salePayments ?? []), ...(records.creditPayments ?? [])]
    .filter(
      (payment) =>
        isInBranch(payment.branchId, filters) &&
        isInPeriod(payment.paymentDate, filters) &&
        isCompletedNonCreditSalePayment(payment),
    )
    .reduce((total, payment) => total + money(payment.amount), 0)
  const paid = signedPayments(records.financePayments, filters) +
    signedPayments(records.payrollPayments, filters)
  const cashTimingWarnings = [
    ...(records.salePaymentTimingAvailable === false
      ? selectedSales.map((sale) => ({
          code: 'MISSING_CASH_TIMING' as const,
          message: 'La venta no tiene un registro de cobro fechado disponible.',
          sourceId: sale.id,
        }))
      : []),
    ...(records.creditPaymentTimingAvailable === false
      ? selectedSales
          .filter((sale) =>
            (records.salePayments ?? []).some(
              (payment) => payment.saleId === sale.id && payment.paymentMethod === 'credit',
            ),
          )
          .map((sale) => ({
            code: 'MISSING_CASH_TIMING' as const,
            message: 'La venta financiada no tiene un registro de cuota fechado disponible.',
            sourceId: sale.id,
          }))
      : []),
    ...selectedRepairs
      .filter((repair) => money(repair.paidAmount) > 0)
      .map((repair) => ({
        code: 'MISSING_CASH_TIMING' as const,
        message: 'La reparación solo tiene un total pagado acumulado, sin un cobro fechado.',
        sourceId: repair.id,
      })),
  ]

  return {
    ...summary,
    complete: summary.complete && cashTimingWarnings.length === 0,
    coverageWarnings: [...summary.coverageWarnings, ...cashTimingWarnings],
    accrued: {
      ...summary.accrued,
      revenue: roundMoneyValue(summary.accrued.revenue),
      directCosts: roundMoneyValue(summary.accrued.directCosts),
      grossProfit: summary.accrued.grossProfit === null ? null : roundMoneyValue(summary.accrued.grossProfit),
      operatingExpenses: roundMoneyValue(summary.accrued.operatingExpenses),
      payrollCost: roundMoneyValue(summary.accrued.payrollCost),
      netProfit: summary.accrued.netProfit === null ? null : roundMoneyValue(summary.accrued.netProfit),
    },
    cash: {
      collected: roundMoneyValue(saleCollected),
      paid: roundMoneyValue(paid),
      netCashFlow: roundMoneyValue(saleCollected - paid),
    },
  }
}

export function buildFinanceSummaryFromRecords(
  records: FinanceSummaryRecords,
  filters: FinanceFilters,
  today = new Date().toISOString().slice(0, 10),
): FinanceSummaryReport {
  const current = buildFinancialSummary(records, filters)
  const dueObligations = records.obligations.filter(
    (obligation) =>
      isInBranch(obligation.branchId, filters) &&
      isInPeriod(obligation.accountingDate, filters) &&
      obligation.status !== 'voided' &&
      obligation.status !== 'paid' &&
      Boolean(obligation.dueDate),
  )
  const toDueRow = (obligation: FinanceObligationRecord) => ({
    id: obligation.id,
    dueDate: obligation.dueDate as string,
    amount: roundMoneyValue(money(obligation.amount)),
  })
  const byDueDate = (left: { dueDate: string }, right: { dueDate: string }) =>
    left.dueDate.localeCompare(right.dueDate)

  return {
    ...current,
    generatedAt: new Date().toISOString(),
    filters,
    comparison: buildFinancialSummary(records, previousPeriod(filters)),
    upcomingDue: dueObligations
      .filter((obligation) => (obligation.dueDate as string) >= today)
      .map(toDueRow)
      .sort(byDueDate),
    overdue: dueObligations
      .filter((obligation) => (obligation.dueDate as string) < today)
      .map(toDueRow)
      .sort(byDueDate),
  }
}

export function assertFinanceReportPage(input: {
  returnedRows: number
  totalRows: number | null | undefined
  source: string
}): void {
  const totalRows = input.totalRows ?? input.returnedRows
  if (
    totalRows > FINANCE_REPORT_QUERY_LIMIT ||
    (input.totalRows == null && input.returnedRows >= FINANCE_REPORT_QUERY_LIMIT)
  ) {
    throw new FinanceApiError(
      `El rango solicitado excede el limite seguro de ${input.source}. Reduce el periodo.`,
      422,
      'FINANCE_REPORT_RANGE_TOO_LARGE',
    )
  }
}

function assertBoundedFinanceRows(
  rows: unknown[] | null,
  source: string,
  count?: number | null,
): asserts rows is unknown[] {
  assertFinanceReportPage({
    returnedRows: rows?.length ?? 0,
    totalRows: count,
    source,
  })
}

async function loadFinanceSummaryRecords(
  organizationId: string,
  filters: FinanceFilters,
): Promise<FinanceSummaryRecords> {
  const admin = createAdminSupabase()
  const comparison = previousPeriod(filters)
  const startDate = comparison.startDate
  const queryEndDate = filters.endDate
  const branch = <T>(query: T): T => filters.branchId
    ? (query as { eq: (column: string, value: string) => T }).eq('branch_id', filters.branchId)
    : query

  const salesQuery = branch(
    admin
      .from('sales')
      .select('id, code, branch_id, created_at, status, total_amount, payment_status, created_by', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('created_at', startDate)
      .lt('created_at', `${nextDay(queryEndDate)}T00:00:00.000Z`)
      .limit(FINANCE_REPORT_QUERY_LIMIT),
  )
  const repairsQuery = branch(
    admin
      .from('repairs')
      .select('id, ticket_number, branch_id, created_at, status, final_cost, estimated_cost, paid_amount, technician_id', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('created_at', startDate)
      .lt('created_at', `${nextDay(queryEndDate)}T00:00:00.000Z`)
      .limit(FINANCE_REPORT_QUERY_LIMIT),
  )
  const obligationsQuery = branch(
    admin
      .from('finance_obligations')
      .select('id, branch_id, accounting_date, due_date, status, amount', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('accounting_date', startDate)
      .lte('accounting_date', queryEndDate)
      .limit(FINANCE_REPORT_QUERY_LIMIT),
  )
  const payrollQuery = branch(
    admin
      .from('payroll_entries')
      .select('id, branch_id, employee_id, net_amount, payroll_runs!inner(status, approved_at)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('payroll_runs.status', 'approved')
      .gte('payroll_runs.approved_at', startDate)
      .lte('payroll_runs.approved_at', queryEndDate)
      .limit(FINANCE_REPORT_QUERY_LIMIT),
  )
  const financePaymentsQuery = branch(
    admin
      .from('finance_payments')
      .select('branch_id, payment_date, direction, amount', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('payment_date', startDate)
      .lte('payment_date', queryEndDate)
      .limit(FINANCE_REPORT_QUERY_LIMIT),
  )
  const payrollPaymentsQuery = branch(
    admin
      .from('payroll_payments')
      .select('branch_id, payment_date, direction, amount', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('payment_date', startDate)
      .lte('payment_date', queryEndDate)
      .limit(FINANCE_REPORT_QUERY_LIMIT),
  )

  const [salesResult, repairsResult, obligationsResult, payrollResult, financePaymentsResult, payrollPaymentsResult] =
    await Promise.all([
      salesQuery,
      repairsQuery,
      obligationsQuery,
      payrollQuery,
      financePaymentsQuery,
      payrollPaymentsQuery,
    ])
  for (const result of [salesResult, repairsResult, obligationsResult, payrollResult, financePaymentsResult, payrollPaymentsResult]) {
    if (result.error) throw toFinanceApiError(result.error)
    assertBoundedFinanceRows(result.data as unknown[] | null, 'reporte financiero', result.count)
  }

  const sales = (salesResult.data ?? []).map((sale) => ({
    id: String(sale.id),
    code: (sale as { code?: string | null }).code ?? null,
    branchId: sale.branch_id ?? null,
    createdAt: String(sale.created_at),
    status: sale.status ?? null,
    totalAmount: money(sale.total_amount),
    paidAmount: 0,
    employeeId: sale.created_by ?? null,
  }))
  const repairs = (repairsResult.data ?? []).map((repair) => ({
    id: String(repair.id),
    ticketNumber: (repair as { ticket_number?: string | null }).ticket_number ?? null,
    branchId: repair.branch_id ?? null,
    createdAt: String(repair.created_at),
    status: repair.status ?? null,
    revenueAmount: money(repair.final_cost ?? repair.estimated_cost),
    paidAmount: money(repair.paid_amount),
    employeeId: repair.technician_id ?? null,
  }))
  const saleItems = await loadSaleItems(admin, organizationId, sales.map((sale) => sale.id))
  const repairParts = await loadRepairParts(admin, repairs.map((repair) => repair.id))
  const salePaymentResult = await loadSalePayments(
    admin,
    organizationId,
    filters,
    startDate,
    queryEndDate,
  )
  const creditPaymentResult = await loadCreditInstallmentPayments(
    admin,
    organizationId,
    filters,
    startDate,
    queryEndDate,
  )

  return {
    sales,
    saleItems,
    salePayments: salePaymentResult.payments,
    salePaymentTimingAvailable: salePaymentResult.available,
    creditPayments: creditPaymentResult.payments,
    creditPaymentTimingAvailable: creditPaymentResult.available,
    repairs,
    repairParts,
    obligations: (obligationsResult.data ?? []).map((obligation) => ({
      id: String(obligation.id),
      branchId: obligation.branch_id ?? null,
      accountingDate: String(obligation.accounting_date),
      dueDate: obligation.due_date ?? null,
      status: String(obligation.status),
      amount: money(obligation.amount),
    })),
    payrollEntries: (payrollResult.data ?? []).map((entry) => {
      const payrollRun = Array.isArray(entry.payroll_runs)
        ? entry.payroll_runs[0]
        : entry.payroll_runs
      return {
        id: String(entry.id),
        branchId: entry.branch_id ?? null,
        approvedAt: payrollRun?.approved_at ?? null,
        status: payrollRun?.status ?? 'draft',
        netAmount: money(entry.net_amount),
        employeeId: entry.employee_id ?? null,
      }
    }),
    financePayments: toFinancePaymentRecords(financePaymentsResult.data ?? []),
    payrollPayments: toFinancePaymentRecords(payrollPaymentsResult.data ?? []),
  }
}

function nextDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function toFinancePaymentRecords(rows: Array<Record<string, unknown>>): FinancePaymentRecord[] {
  return rows.map((payment) => ({
    branchId: typeof payment.branch_id === 'string' ? payment.branch_id : null,
    paymentDate: String(payment.payment_date),
    direction: payment.direction === 'reversal' ? 'reversal' : 'payment',
    amount: money(payment.amount as number | string | null | undefined),
  }))
}

function isMissingTableError(error: unknown, table: string): boolean {
  const candidate = error as SupabaseErrorLike | null
  return candidate?.code === '42P01' &&
    String(candidate.message ?? '').toLowerCase().includes(table)
}

async function loadSalePayments(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  filters: FinanceFilters,
  startDate: string,
  endDate: string,
): Promise<{ payments: FinanceSalePaymentRecord[]; available: boolean }> {
  let query = admin
    .from('sale_payments')
    .select('sale_id, payment_method, amount, status, created_at, sales!inner(branch_id)', {
      count: 'exact',
    })
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lt('created_at', `${nextDay(endDate)}T00:00:00.000Z`)
    .limit(FINANCE_REPORT_QUERY_LIMIT)
  if (filters.branchId) query = query.eq('sales.branch_id', filters.branchId)

  const result = await query
  if (result.error) {
    if (isMissingTableError(result.error, 'sale_payments')) {
      return { payments: [], available: false }
    }
    throw toFinanceApiError(result.error)
  }
  assertBoundedFinanceRows(result.data as unknown[] | null, 'cobros de venta', result.count)
  return {
    payments: (result.data ?? []).map((payment) => {
      const sale = Array.isArray(payment.sales) ? payment.sales[0] : payment.sales
      return {
        saleId: String(payment.sale_id),
        branchId: sale?.branch_id ?? null,
        paymentDate: String(payment.created_at),
        paymentMethod: String(payment.payment_method ?? '').trim().toLowerCase(),
        status: String(payment.status ?? '').trim().toLowerCase(),
        amount: money(payment.amount),
      }
    }),
    available: true,
  }
}

async function loadCreditInstallmentPayments(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  filters: FinanceFilters,
  startDate: string,
  endDate: string,
): Promise<{ payments: FinanceSalePaymentRecord[]; available: boolean }> {
  let query = admin
    .from('credit_payments')
    .select(
      'amount, payment_method, created_at, customer_credits!inner(sale_id, branch_id, organization_id)',
      { count: 'exact' },
    )
    .eq('customer_credits.organization_id', organizationId)
    .not('customer_credits.sale_id', 'is', null)
    .in('payment_method', ['cash', 'card', 'transfer'])
    .gt('amount', 0)
    .gte('created_at', startDate)
    .lt('created_at', `${nextDay(endDate)}T00:00:00.000Z`)
    .limit(FINANCE_REPORT_QUERY_LIMIT)
  if (filters.branchId) query = query.eq('customer_credits.branch_id', filters.branchId)

  const result = await query
  if (result.error) {
    if (isMissingTableError(result.error, 'credit_payments')) {
      return { payments: [], available: false }
    }
    throw toFinanceApiError(result.error)
  }
  assertBoundedFinanceRows(result.data as unknown[] | null, 'cobros de cuotas', result.count)
  return {
    payments: (result.data ?? []).flatMap((payment) => {
      const credit = Array.isArray(payment.customer_credits)
        ? payment.customer_credits[0]
        : payment.customer_credits
      if (!credit?.sale_id) return []
      return [{
        saleId: String(credit.sale_id),
        branchId: credit.branch_id ?? null,
        paymentDate: String(payment.created_at),
        paymentMethod: String(payment.payment_method ?? '').trim().toLowerCase(),
        // This table has no reversal/status state; the current persisted row is
        // admitted only when it is a positive settlement in a schema-valid method.
        status: 'completed',
        amount: money(payment.amount),
      }]
    }),
    available: true,
  }
}

async function loadSaleCostSnapshots(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  saleIds: string[],
): Promise<Map<string, number>> {
  if (saleIds.length === 0) return new Map()
  const results = await Promise.all(
    chunkQueryValues(saleIds).map((ids) =>
      admin
        .from('sale_item_cost_snapshots')
        .select('sale_item_id, unit_cost', { count: 'exact' })
        .eq('organization_id', organizationId)
        .in('sale_id', ids)
        .limit(FINANCE_REPORT_QUERY_LIMIT),
    ),
  )
  const snapshots = new Map<string, number>()
  for (const result of results) {
    if (result.error) {
      // A deployment that has not yet applied the immutable-snapshot migration
      // remains explicitly incomplete; the summary emits MISSING_DIRECT_COST
      // instead of replacing history with products.purchase_price.
      if (isMissingTableError(result.error, 'sale_item_cost_snapshots')) return snapshots
      throw toFinanceApiError(result.error)
    }
    assertBoundedFinanceRows(result.data as unknown[] | null, 'costos históricos de venta', result.count)
    for (const snapshot of result.data ?? []) {
      if (!snapshot.sale_item_id || snapshot.unit_cost === null) {
        continue
      }
      snapshots.set(
        String(snapshot.sale_item_id),
        money(snapshot.unit_cost),
      )
    }
  }
  return snapshots
}

export function toFinanceSaleItemFromSnapshot(
  item: {
    saleId: string
    productId?: string | null
    quantity: number
    revenueAmount?: number | null
  },
  historicalUnitCost: number | null,
): FinanceSaleItemRecord {
  return {
    saleId: item.saleId,
    productId: item.productId ?? null,
    productName: null,
    quantity: money(item.quantity),
    unitCost: historicalUnitCost === null ? null : money(historicalUnitCost),
    revenueAmount: money(item.revenueAmount),
  }
}

async function loadSaleItems(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  saleIds: string[],
): Promise<FinanceSaleItemRecord[]> {
  if (saleIds.length === 0) return []
  const costSnapshots = await loadSaleCostSnapshots(admin, organizationId, saleIds)
  const results = await Promise.all(
    chunkQueryValues(saleIds).map((ids) =>
      admin
        .from('sale_items')
        .select('id, sale_id, product_id, quantity, subtotal', { count: 'exact' })
        .eq('organization_id', organizationId)
        .in('sale_id', ids)
        .limit(FINANCE_REPORT_QUERY_LIMIT),
    ),
  )
  const items: FinanceSaleItemRecord[] = []
  for (const result of results) {
    if (result.error) throw toFinanceApiError(result.error)
    assertBoundedFinanceRows(result.data as unknown[] | null, 'items de venta', result.count)
    for (const item of result.data ?? []) {
      const snapshotCost = costSnapshots.get(String(item.id))
      items.push(toFinanceSaleItemFromSnapshot({
        saleId: String(item.sale_id),
        productId: item.product_id ?? null,
        quantity: money(item.quantity),
        revenueAmount: money(item.subtotal),
      }, snapshotCost ?? null))
    }
  }
  return items
}

async function loadRepairParts(
  admin: ReturnType<typeof createAdminSupabase>,
  repairIds: string[],
): Promise<FinanceRepairPartRecord[]> {
  if (repairIds.length === 0) return []
  const results = await Promise.all(
    chunkQueryValues(repairIds).map((ids) =>
      admin
        .from('repair_parts')
        .select('repair_id, quantity, unit_cost, status', { count: 'exact' })
        .in('repair_id', ids)
        .limit(FINANCE_REPORT_QUERY_LIMIT),
    ),
  )
  const parts: FinanceRepairPartRecord[] = []
  for (const result of results) {
    if (result.error) throw toFinanceApiError(result.error)
    assertBoundedFinanceRows(result.data as unknown[] | null, 'repuestos de reparación', result.count)
    for (const part of result.data ?? []) {
      parts.push({
        repairId: String(part.repair_id),
        quantity: money(part.quantity),
        unitCost: part.unit_cost === null || part.unit_cost === undefined
          ? null
          : money(part.unit_cost),
        status: part.status ?? null,
      })
    }
  }
  return parts
}

export async function getFinanceSummary(
  organizationId: string,
  filters: FinanceFilters,
): Promise<FinanceSummaryReport> {
  const records = await loadFinanceSummaryRecords(organizationId, filters)
  return buildFinanceSummaryFromRecords(records, filters)
}

export async function getFinanceProfitability(
  organizationId: string,
  filters: FinanceFilters,
  group: FinanceProfitabilityGroup,
): Promise<FinanceProfitabilityRow[]> {
  const records = await loadFinanceSummaryRecords(organizationId, filters)
  const rows = buildProfitabilityRows(records, filters, group)

  // Al agrupar por empleado o sucursal, buildProfitabilityRows deja el UUID
  // como etiqueta (no tiene los nombres a mano). Acá se resuelven a nombres
  // reales para que la columna "Detalle" sea legible en vez de un UUID.
  if (group !== 'employee' && group !== 'branch') return rows

  const idPrefix = group === 'employee' ? 'employee:' : 'branch:'
  const sentinel = group === 'employee' ? 'unassigned' : 'organization'
  const ids = rows
    .map((row) => row.id.slice(idPrefix.length))
    .filter((id) => id && id !== sentinel)
  if (ids.length === 0) return rows

  const admin = createAdminSupabase()
  const nameById = new Map<string, string>()
  if (group === 'employee') {
    const { data } = await admin.from('profiles').select('id, full_name, email').in('id', ids)
    for (const profile of data ?? []) {
      const name = (profile.full_name as string | null)?.trim() || (profile.email as string | null) || null
      if (name) nameById.set(String(profile.id), name)
    }
  } else {
    const { data } = await admin.from('branches').select('id, name').in('id', ids).eq('organization_id', organizationId)
    for (const branchRow of data ?? []) {
      if (branchRow.name) nameById.set(String(branchRow.id), String(branchRow.name))
    }
  }

  return rows.map((row) => {
    const rawId = row.id.slice(idPrefix.length)
    const resolved = nameById.get(rawId)
    return resolved ? { ...row, label: resolved } : row
  })
}

function buildProfitabilityRows(
  records: FinanceSummaryRecords,
  filters: FinanceFilters,
  group: FinanceProfitabilityGroup,
): FinanceProfitabilityRow[] {
  const sales = records.sales.filter(
    (sale) => isInBranch(sale.branchId, filters) && isInPeriod(sale.createdAt, filters) && isCompletedSaleStatus(sale.status),
  )
  const repairs = records.repairs.filter(
    (repair) => isInBranch(repair.branchId, filters) && isInPeriod(repair.createdAt, filters) && !isCancelledRepair(repair.status),
  )
  const saleItemsBySaleId = new Map<string, FinanceSaleItemRecord[]>()
  for (const item of records.saleItems) {
    const items = saleItemsBySaleId.get(item.saleId) ?? []
    items.push(item)
    saleItemsBySaleId.set(item.saleId, items)
  }
  const repairPartsByRepairId = new Map<string, FinanceRepairPartRecord[]>()
  for (const part of records.repairParts) {
    const parts = repairPartsByRepairId.get(part.repairId) ?? []
    parts.push(part)
    repairPartsByRepairId.set(part.repairId, parts)
  }
  const rows = new Map<string, { label: string; revenue: number; directCosts: number; complete: boolean }>()
  const add = (id: string, label: string, revenue: number, directCosts: number, complete: boolean) => {
    const row = rows.get(id) ?? { label, revenue: 0, directCosts: 0, complete: true }
    row.revenue += revenue
    row.directCosts += directCosts
    row.complete = row.complete && complete
    rows.set(id, row)
  }
  const saleKey = (sale: FinanceSaleRecord) => {
    if (group === 'employee') return [`employee:${sale.employeeId ?? 'unassigned'}`, sale.employeeId ?? 'Sin empleado'] as const
    if (group === 'branch') return [`branch:${sale.branchId ?? 'organization'}`, sale.branchId ?? 'Organización'] as const
    // Etiqueta legible para la fila de una venta: su código, o el id corto
    // como respaldo — nunca el UUID completo.
    return [`sale:${sale.id}`, sale.code ?? `Venta ${sale.id.slice(0, 8)}`] as const
  }
  for (const sale of sales) {
    if (group === 'product') {
      for (const item of saleItemsBySaleId.get(sale.id) ?? []) {
        const complete = item.unitCost !== null
        add(
          `product:${item.productId ?? 'missing'}`,
          item.productName ?? item.productId ?? 'Producto sin identificar',
          money(item.revenueAmount),
          complete ? money(item.quantity) * money(item.unitCost) : 0,
          complete,
        )
      }
      continue
    }
    const [id, label] = saleKey(sale)
    const items = saleItemsBySaleId.get(sale.id) ?? []
    add(
      id,
      label,
      money(sale.totalAmount),
      items.reduce((total, item) => total + (item.unitCost === null ? 0 : money(item.quantity) * money(item.unitCost)), 0),
      items.length > 0 && items.every((item) => item.unitCost !== null),
    )
  }
  for (const repair of repairs) {
    if (group === 'product') continue
    const key = group === 'employee'
      ? [`employee:${repair.employeeId ?? 'unassigned'}`, repair.employeeId ?? 'Sin empleado'] as const
      : group === 'branch'
        ? [`branch:${repair.branchId ?? 'organization'}`, repair.branchId ?? 'Organización'] as const
        // Ticket de la reparación como etiqueta legible, id corto de respaldo.
        : [`repair:${repair.id}`, repair.ticketNumber ?? `Reparación ${repair.id.slice(0, 8)}`] as const
    const parts = repairPartsByRepairId.get(repair.id) ?? []
    add(
      key[0],
      key[1],
      money(repair.revenueAmount),
      parts.reduce(
        (total, part) => total + (part.unitCost === null ? 0 : money(part.quantity) * money(part.unitCost)),
        0,
      ),
      parts.every((part) => part.unitCost !== null),
    )
  }
  return Array.from(rows.entries())
    .map(([id, row]) => {
      const summary = calculateFinancialSummary({
        revenue: [{ id, amount: row.revenue, cashAmount: 0, hasCost: row.complete }],
        directCosts: [{ id, amount: row.directCosts, paidAmount: 0 }],
        expenses: [],
        payroll: [],
      })
      return {
        id,
        label: row.label,
        group,
        revenue: roundMoneyValue(row.revenue),
        directCosts: row.complete ? roundMoneyValue(row.directCosts) : null,
        grossProfit: summary.accrued.grossProfit,
        complete: row.complete,
      }
    })
    .sort((left, right) => right.revenue - left.revenue || left.label.localeCompare(right.label))
}
