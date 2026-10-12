import type { createAdminSupabase } from '@/lib/supabase/admin'
import {
  buildCreditInstallmentPlan,
  type CreditFrequency,
  type FirstInstallmentTiming,
  creditBusinessDate,
} from '@/lib/credits/installments'

export type CreateCreditAccountInput = {
  supabase: ReturnType<typeof createAdminSupabase>
  organizationId: string
  customerId: string
  actorId: string
  /** Kept for caller compatibility; the database's current limit is authoritative. */
  creditLimit: number
  amount: number
  interestRate: number
  installmentCount: number
  frequency: CreditFrequency
  dueDate?: Date | null
  firstInstallmentTiming?: FirstInstallmentTiming
  saleId?: string | null
  label: string
  creditType: string
  originType: string
}

export type CreateCreditAccountResult = {
  creditId: string
  financedTotal: number
  interestAmount: number
  installmentCount: number
}

export class CreditAccountError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'CreditAccountError'
  }
}

/** Header, installments and final cupo validation belong to one database transaction. */
export async function createCreditAccount(input: CreateCreditAccountInput): Promise<CreateCreditAccountResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.actorId ?? '')) {
    throw new CreditAccountError('No se pudo validar quién concede el crédito.', 403)
  }
  const startedAt = new Date()
  const plan = buildCreditInstallmentPlan({
    principalAmount: input.amount,
    interestRate: input.interestRate,
    installmentCount: input.installmentCount,
    frequency: input.frequency,
    firstDueDate: input.dueDate ?? null,
    firstInstallmentTiming: input.firstInstallmentTiming,
    now: new Date(`${creditBusinessDate(startedAt)}T12:00:00Z`),
    startInstallmentNumber: 1,
  })
  const { data, error } = await input.supabase.rpc('create_customer_credit_account_atomic', {
    p_organization_id: input.organizationId,
    p_customer_id: input.customerId,
    p_actor_id: input.actorId,
    p_header: {
      sale_id: input.saleId ?? null,
      principal: plan.financedTotal,
      interest_rate: input.interestRate,
      term_months: input.installmentCount,
      credit_type: input.creditType,
      origin_type: input.originType,
      label: input.label,
      metadata: { frequency: input.frequency, first_installment_timing: input.dueDate ? 'custom' : input.firstInstallmentTiming ?? 'at_start' },
    },
    p_installments: plan.installments.map(installment => ({
      installment_number: installment.installmentNumber,
      due_date: installment.dueDate.toISOString(),
      amount: installment.amount,
      principal_component: installment.principalComponent,
      interest_component: installment.interestComponent,
    })),
  })
  if (error) {
    // Do not log RPC payloads or raw database errors: this flow handles private customer data.
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new CreditAccountError('La creación de crédito requiere actualizar la base de datos.', 503)
    }
    if (error.message?.includes('CREDIT_FILE_REQUIRED')) {
      throw new CreditAccountError('La ficha del cliente necesita aprobación y los requisitos vigentes antes de conceder crédito.', 409)
    }
    if (error.message?.includes('CREDIT_LIMIT_EXCEEDED')) {
      throw new CreditAccountError('El cliente no tiene crédito disponible suficiente. Revisá su saldo y límite actuales.', 400)
    }
    if (error.code === '42501' || error.message?.includes('CREDIT_FILE_FORBIDDEN')) {
      throw new CreditAccountError('No tenés permisos para conceder este crédito.', 403)
    }
    if (error.code === '23505') {
      throw new CreditAccountError('La venta ya tiene un crédito asociado.', 409)
    }
    throw new CreditAccountError('No se pudo crear el crédito y sus cuotas. No se guardó ningún cambio.', 500)
  }
  const result = data as CreateCreditAccountResult | null
  if (!result?.creditId) throw new CreditAccountError('No se pudo confirmar el crédito creado.', 500)
  return result
}
