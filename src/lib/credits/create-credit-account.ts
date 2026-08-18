import type { createAdminSupabase } from '@/lib/supabase/admin'
import {
  sumInstallmentsOutstanding,
  sumRepairsOutstanding,
  type OutstandingRepair,
} from './customer-outstanding'
import {
  buildCreditInstallmentPlan,
  type CreditFrequency,
} from '@/lib/credits/installments'

type AdminSupabase = ReturnType<typeof createAdminSupabase>

type InstallmentRow = {
  installment_number: number
  amount?: number | string | null
  status?: string | null
  amount_paid?: number | string | null
}

export type CreateCreditAccountInput = {
  supabase: AdminSupabase
  organizationId: string
  customerId: string
  /** Límite de crédito del cliente, ya validado por el caller. */
  creditLimit: number
  /** Capital a financiar (sin interés). */
  amount: number
  interestRate: number
  installmentCount: number
  frequency: CreditFrequency
  dueDate?: Date | null
  /** Venta asociada, o null para crédito manual (p.ej. reparación). */
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

/** Error de creación de crédito con el status HTTP apropiado para la respuesta. */
export class CreditAccountError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'CreditAccountError'
    this.status = status
  }
}

function buildCreditCode() {
  return `CR-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/**
 * Núcleo de creación de una cuenta de crédito: valida el cupo disponible del
 * cliente, inserta la cabecera en `customer_credits` y su plan de cuotas en
 * `credit_installments`, con rollback de la cabecera si las cuotas fallan.
 *
 * Fuente única compartida entre la venta a crédito del POS (`/api/credits/sale`)
 * y el cobro a crédito de reparaciones (`/api/repairs/[id]/payment`), para que
 * ambos flujos apliquen exactamente las mismas reglas de cupo y estructura.
 */
/**
 * Lanza {@link CreditAccountError} (con su status HTTP) ante cualquier fallo, y
 * devuelve los datos del crédito creado en el caso exitoso.
 */
export async function createCreditAccount(
  input: CreateCreditAccountInput
): Promise<CreateCreditAccountResult> {
  const {
    supabase,
    organizationId,
    customerId,
    creditLimit,
    amount,
    interestRate,
    installmentCount,
    frequency,
    dueDate = null,
    saleId = null,
    label,
    creditType,
    originType,
  } = input

  // Saldo pendiente actual del cliente (para no exceder su cupo).
  const { data: existingCredits, error: existingCreditsError } = await supabase
    .from('customer_credits')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)

  if (existingCreditsError) {
    console.error('[createCreditAccount] Error fetching customer credits:', existingCreditsError)
    throw new CreditAccountError('No se pudo validar el historial de créditos del cliente.', 500)
  }

  const existingCreditIds = (existingCredits ?? []).map((row) => row.id as string).filter(Boolean)
  const { data: existingInstallments, error: existingInstallmentsError } = existingCreditIds.length > 0
    ? await supabase
        .from('credit_installments')
        .select('installment_number, amount, status, amount_paid')
        .in('credit_id', existingCreditIds)
    : { data: [], error: null }

  if (existingInstallmentsError) {
    console.error('[createCreditAccount] Error fetching credit installments:', existingInstallmentsError)
    throw new CreditAccountError('No se pudo preparar el plan de crédito del cliente.', 500)
  }

  const creditPlan = buildCreditInstallmentPlan({
    principalAmount: amount,
    interestRate,
    installmentCount,
    frequency,
    firstDueDate: dueDate,
    startInstallmentNumber: 1,
  })

  const installmentsBalance = sumInstallmentsOutstanding(
    (existingInstallments as InstallmentRow[] | null) ?? []
  )

  // La deuda de reparaciones tambien consume la linea de credito: cualquier
  // saldo abierto del cliente ocupa cupo, no solo las ventas financiadas. Antes
  // el servidor solo miraba las cuotas y la ficha del cliente ya descontaba las
  // reparaciones, asi que la pantalla y la caja no coincidian.
  const { data: customerRepairs, error: customerRepairsError } = await supabase
    .from('repairs')
    .select('status, payment_status, final_cost, estimated_cost, paid_amount')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)

  if (customerRepairsError) {
    console.error('[createCreditAccount] Error fetching customer repairs:', customerRepairsError)
    throw new CreditAccountError('No se pudo validar la deuda de reparaciones del cliente.', 500)
  }

  const repairsBalance = sumRepairsOutstanding((customerRepairs ?? []) as OutstandingRepair[])
  const currentBalance = installmentsBalance + repairsBalance

  const availableCredit = creditLimit - currentBalance
  if (availableCredit < creditPlan.financedTotal) {
    throw new CreditAccountError(
      `El cliente no tiene crédito disponible suficiente. Disponible: ${availableCredit.toFixed(2)}.`,
      400
    )
  }

  const { data: creditRow, error: createCreditError } = await supabase
    .from('customer_credits')
    .insert({
      customer_id: customerId,
      organization_id: organizationId,
      sale_id: saleId,
      principal: creditPlan.financedTotal,
      interest_rate: interestRate,
      term_months: installmentCount,
      start_date: new Date().toISOString(),
      status: 'active',
      credit_code: buildCreditCode(),
      credit_type: creditType,
      origin_type: originType,
      label,
    })
    .select('id')
    .single()

  if (createCreditError || !creditRow?.id) {
    console.error('[createCreditAccount] Error creating credit header:', createCreditError)
    throw new CreditAccountError('No se pudo crear la cuenta de crédito del cliente.', 500)
  }

  const creditId = creditRow.id as string

  const installmentsToInsert = creditPlan.installments.map((installment) => ({
    credit_id: creditId,
    sale_id: saleId,
    installment_number: installment.installmentNumber,
    due_date: installment.dueDate.toISOString(),
    amount: installment.amount,
    principal_component: installment.principalComponent,
    interest_component: installment.interestComponent,
    status: 'pending',
  }))

  const { error: installmentsError } = await supabase
    .from('credit_installments')
    .insert(installmentsToInsert)

  if (installmentsError) {
    console.error('[createCreditAccount] Error creating installments:', installmentsError)
    await supabase.from('customer_credits').delete().eq('id', creditId).eq('organization_id', organizationId)
    throw new CreditAccountError('No se pudieron generar las cuotas del crédito.', 500)
  }

  return {
    creditId,
    financedTotal: creditPlan.financedTotal,
    interestAmount: creditPlan.interestAmount,
    installmentCount,
  }
}
