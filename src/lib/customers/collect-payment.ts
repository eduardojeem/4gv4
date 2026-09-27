import { z } from 'zod'
import { resolveRepairCollectionPricing } from '@/lib/repairs/collection-pricing'
import type { RepairPricingMode } from '@/lib/repairs/pricing'

/**
 * Cobro unificado a un cliente: sus reparaciones y cuotas pendientes en un solo
 * pago.
 *
 * Qué había y por qué se reescribió:
 *
 * - El POST no verificaba que el cliente fuera de la organización. Con el
 *   cliente de servicio, que se salta RLS, un empleado de otra empresa podía
 *   marcar cuotas como pagadas conociendo un ID.
 * - Escribía `paid_amount` a mano en cada reparación, sin bloquear la fila ni
 *   revisar errores: dos cobros simultáneos se pisaban y un fallo a mitad de
 *   camino devolvía «Pago registrado» igual.
 * - Nada pasaba por la caja, así que el arqueo no cuadraba.
 * - Ofrecía cobrar reparaciones canceladas y cuotas de créditos cancelados, y
 *   calculaba el saldo con `final_cost ?? estimated_cost`, distinto del que usa
 *   el cobro de la propia reparación.
 *
 * Ahora cada deuda se cobra por el camino que ya existía y es seguro: la
 * reparación con `close_repair_and_register_payment_v2` y la cuota con
 * `register_credit_payment_atomic`. Los dos validan la organización, bloquean
 * la fila, respetan la caja abierta y dejan el movimiento registrado.
 */

export type DebtType = 'repair' | 'installment'

export interface DebtItem {
  id: string
  type: DebtType
  title: string
  subtitle?: string
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  dueDate?: string
  isOverdue: boolean
  status: string
  operationalStatus?: string
  repairCategory?: 'in_progress' | 'ready_for_pickup' | 'delivered_unpaid'
  debtReason?: string
  creditId?: string
  /** Si se puede cobrar desde la sucursal activa. */
  collectable: boolean
  /** Por qué no se puede cobrar desde acá. */
  blockedReason?: string
}

export const COLLECT_PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const
export type CollectPaymentMethod = (typeof COLLECT_PAYMENT_METHODS)[number]

/** Tope de un cobro en guaraníes: un monto así es un error de tipeo, no un pago. */
export const COLLECT_PAYMENT_MAX_AMOUNT = 1_000_000_000

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal('')).transform((v) => v || undefined)

export const collectPaymentRequestSchema = z.object({
  amount: z.number({ message: 'Ingresá el monto a cobrar.' })
    .int('El monto va en guaraníes enteros.')
    .positive('El monto a cobrar debe ser mayor a 0.')
    .max(COLLECT_PAYMENT_MAX_AMOUNT, 'El monto supera el máximo permitido para un cobro.'),
  paymentMethod: z.enum(COLLECT_PAYMENT_METHODS, { message: 'Elegí efectivo, tarjeta o transferencia.' }),
  mode: z.enum(['auto', 'manual']).default('auto'),
  allocations: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['repair', 'installment']),
    amount: z.number().int().min(0),
  })).max(200).optional(),
  bankName: optionalText(120),
  referenceNumber: optionalText(120),
  cardType: z.enum(['debit', 'credit']).optional(),
  posNetwork: optionalText(120),
  voucherNumber: optionalText(120),
  lastFourDigits: z.string().trim().regex(/^\d{4}$/, 'Los últimos dígitos de la tarjeta son 4 números.').optional().or(z.literal('')).transform((v) => v || undefined),
  notes: optionalText(500),
  /** El sobrante va a saldo a favor solo si quien cobra lo confirmó. */
  creditExcessToStoreCredit: z.boolean().default(false),
  idempotencyKey: z.string().trim().min(8).max(120),
  branchId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  // Los mismos comprobantes que exige el cobro de la reparación: sin ellos una
  // transferencia o un cobro con tarjeta no se puede conciliar después.
  if (value.paymentMethod === 'transfer' && !value.referenceNumber) {
    ctx.addIssue({ code: 'custom', path: ['referenceNumber'], message: 'Ingresá el número de comprobante de la transferencia.' })
  }
  if (value.paymentMethod === 'card' && !value.voucherNumber) {
    ctx.addIssue({ code: 'custom', path: ['voucherNumber'], message: 'Ingresá el número de cupón del POS.' })
  }
})

export type CollectPaymentRequest = z.infer<typeof collectPaymentRequestSchema>

/** El comprobante que exigen los caminos de pago para tarjeta y transferencia. */
export function paymentReference(input: Pick<CollectPaymentRequest, 'paymentMethod' | 'referenceNumber' | 'voucherNumber'>) {
  if (input.paymentMethod === 'transfer') return input.referenceNumber ?? null
  if (input.paymentMethod === 'card') return input.voucherNumber ?? null
  return null
}

export function paymentNote(input: Pick<CollectPaymentRequest, 'paymentMethod' | 'bankName' | 'cardType' | 'posNetwork' | 'lastFourDigits' | 'notes'>) {
  const parts: string[] = []
  if (input.notes) parts.push(input.notes)
  if (input.paymentMethod === 'transfer' && input.bankName) parts.push(`Transferencia ${input.bankName}`)
  if (input.paymentMethod === 'card') {
    parts.push([
      `Tarjeta de ${input.cardType === 'credit' ? 'crédito' : 'débito'}`,
      input.posNetwork,
      input.lastFourDigits ? `terminada en ${input.lastFourDigits}` : null,
    ].filter(Boolean).join(' · '))
  }
  return parts.join(' — ') || null
}

type Row = Record<string, unknown>

type QueryResult = { data: unknown[] | null; error: unknown }

/** Lo mínimo que se usa del cliente de Supabase, para poder probarlo con uno falso. */
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown[]) => QueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
}

type SupabaseLike = {
  from: (table: string) => unknown
}

const query = (supabase: SupabaseLike, table: string) => supabase.from(table) as QueryBuilder

const CANCELLED_REPAIR = new Set(['cancelado', 'cancelled', 'canceled'])
const CANCELLED_CREDIT = new Set(['cancelled', 'canceled', 'cancelado'])

function repairLabels(status: string, delivered: boolean) {
  if (delivered) {
    return {
      category: 'delivered_unpaid' as const,
      status: 'Retirado (entregado con saldo)',
      reason: 'Equipo ya retirado por el cliente con deuda pendiente',
    }
  }
  if (status === 'listo' || status === 'reparado') {
    return {
      category: 'ready_for_pickup' as const,
      status: 'Terminado (pendiente de retiro)',
      reason: 'Reparación terminada, lista para entregar',
    }
  }
  if (status === 'diagnostico') {
    return { category: 'in_progress' as const, status: 'En taller (en diagnóstico)', reason: 'En diagnóstico técnico (presupuesto estimado)' }
  }
  if (status === 'reparacion') {
    return { category: 'in_progress' as const, status: 'En taller (en reparación)', reason: 'En proceso de reparación' }
  }
  return { category: 'in_progress' as const, status: 'En taller (recibido)', reason: 'Equipo recibido en taller' }
}

/** Primero lo vencido; dentro de cada grupo, lo más antiguo. */
export function sortDebts(debts: DebtItem[]) {
  return [...debts].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    return 0
  })
}

/**
 * Las deudas pendientes del cliente, todas acotadas a la organización.
 * Las reparaciones de otra sucursal se listan pero no se pueden cobrar desde
 * esta: la plata tiene que entrar a la caja donde se recibe.
 */
export async function loadCustomerDebts(
  supabase: SupabaseLike,
  input: { organizationId: string; customerId: string; branchId: string | null; now?: Date }
): Promise<{ debts: DebtItem[]; error: string | null }> {
  const today = new Date(input.now ?? Date.now())
  today.setHours(0, 0, 0, 0)
  const debts: DebtItem[] = []

  const repairsResult = await query(supabase, 'repairs')
    .select('id, ticket_number, device_brand, device_model, problem_description, status, branch_id, pricing_mode, labor_cost, final_cost, estimated_cost, discount_amount, paid_amount, payment_status, delivered_at, created_at, parts:repair_parts(unit_price, unit_cost, quantity)')
    .eq('customer_id', input.customerId)
    .eq('organization_id', input.organizationId)

  if (repairsResult.error) return { debts: [], error: 'No se pudieron leer las reparaciones del cliente.' }

  for (const r of (repairsResult.data ?? []) as Row[]) {
    const status = String(r.status ?? 'recibido').toLowerCase()
    // Una reparación cancelada no se cobra: el propio cobro de reparaciones la rechaza.
    if (CANCELLED_REPAIR.has(status)) continue

    const { pricing } = resolveRepairCollectionPricing({
      mode: (r.pricing_mode as RepairPricingMode | null) ?? undefined,
      laborCost: r.labor_cost as number | null,
      finalCost: r.final_cost as number | null,
      estimatedCost: r.estimated_cost as number | null,
      discountAmount: r.discount_amount as number | null,
      paidAmount: r.paid_amount as number | null,
      parts: ((r.parts as Row[] | null) ?? []).map((part) => ({
        cost: (part.unit_price ?? part.unit_cost) as number | null,
        internalCost: part.unit_cost as number | null,
        quantity: part.quantity as number | null,
      })),
    })

    if (pricing.balance <= 0) continue

    const delivered = status === 'entregado' || Boolean(r.delivered_at)
    const labels = repairLabels(status, delivered)
    const sameBranch = Boolean(input.branchId) && r.branch_id === input.branchId

    debts.push({
      id: String(r.id),
      type: 'repair',
      title: `Reparación #${r.ticket_number || String(r.id).slice(-6)}`,
      subtitle: [r.device_brand, r.device_model].filter(Boolean).join(' ') || (r.problem_description as string) || 'Servicio técnico',
      totalAmount: pricing.customerTotal,
      paidAmount: pricing.paidAmount,
      pendingAmount: pricing.balance,
      dueDate: (r.created_at as string) ?? undefined,
      isOverdue: delivered,
      status: labels.status,
      operationalStatus: status,
      repairCategory: labels.category,
      debtReason: labels.reason,
      collectable: sameBranch,
      blockedReason: sameBranch
        ? undefined
        : input.branchId
          ? 'Es de otra sucursal: cobrala desde esa sucursal, así entra a su caja.'
          : 'Elegí una sucursal para cobrar reparaciones.',
    })
  }

  const creditsResult = await query(supabase, 'customer_credits')
    .select('id, status')
    .eq('customer_id', input.customerId)
    .eq('organization_id', input.organizationId)

  if (creditsResult.error) return { debts: [], error: 'No se pudieron leer los créditos del cliente.' }

  // Un crédito cancelado no se cobra. Se filtra acá y no con `neq` en la
  // consulta, que dejaría afuera los créditos sin estado.
  const credits = ((creditsResult.data ?? []) as Row[])
    .filter((c) => !CANCELLED_CREDIT.has(String(c.status ?? '').toLowerCase()))

  if (credits.length > 0) {
    const installmentsResult = await query(supabase, 'credit_installments')
      .select('id, credit_id, installment_number, due_date, amount, amount_paid, status')
      .in('credit_id', credits.map((c) => c.id))
      .order('due_date', { ascending: true })

    if (installmentsResult.error) return { debts: [], error: 'No se pudieron leer las cuotas del cliente.' }

    for (const inst of (installmentsResult.data ?? []) as Row[]) {
      const amount = Number(inst.amount || 0)
      const paid = Number(inst.amount_paid || 0)
      const pending = Math.max(0, amount - paid)
      if (inst.status === 'paid' || pending <= 0 || amount <= 0) continue

      const due = inst.due_date ? new Date(String(inst.due_date)) : null
      const late = inst.status === 'late' || (due ? due < today : false)

      debts.push({
        id: String(inst.id),
        type: 'installment',
        title: `Crédito #${String(inst.credit_id).slice(-6)} · cuota ${inst.installment_number ?? ''}`.trim(),
        subtitle: due ? `Vence: ${due.toLocaleDateString('es-PY')}` : 'Cuota de crédito',
        totalAmount: amount,
        paidAmount: paid,
        pendingAmount: pending,
        dueDate: (inst.due_date as string) ?? undefined,
        isOverdue: late,
        status: late ? 'Vencida' : 'Pendiente',
        operationalStatus: late ? 'vencido' : 'vigente',
        debtReason: late ? 'Cuota de crédito vencida' : 'Cuota de crédito al día',
        creditId: String(inst.credit_id),
        collectable: true,
      })
    }
  }

  return { debts: sortDebts(debts), error: null }
}

export type PlannedAllocation = { debt: DebtItem; amount: number }

/**
 * Cómo se reparte el monto. Solo entre deudas que se pueden cobrar desde acá,
 * nunca más de lo pendiente de cada una ni más del monto recibido.
 */
export function planAllocations(
  debts: DebtItem[],
  input: { amount: number; mode: 'auto' | 'manual'; allocations?: Array<{ id: string; amount: number }> }
): { allocations: PlannedAllocation[]; excess: number } {
  let remaining = Math.max(0, Math.trunc(input.amount))
  const allocations: PlannedAllocation[] = []
  const collectable = sortDebts(debts).filter((d) => d.collectable)

  if (input.mode === 'auto') {
    for (const debt of collectable) {
      if (remaining <= 0) break
      const amount = Math.min(remaining, debt.pendingAmount)
      if (amount > 0) {
        allocations.push({ debt, amount })
        remaining -= amount
      }
    }
  } else {
    const requested = new Map((input.allocations ?? []).map((a) => [a.id, Math.max(0, Math.trunc(Number(a.amount) || 0))]))
    for (const debt of collectable) {
      if (remaining <= 0) break
      const amount = Math.min(requested.get(debt.id) ?? 0, debt.pendingAmount, remaining)
      if (amount > 0) {
        allocations.push({ debt, amount })
        remaining -= amount
      }
    }
  }

  return { allocations, excess: remaining }
}

/** Número de recibo con fecha y un tramo aleatorio: el anterior se repetía cada pocos minutos. */
export function buildReceiptNumber(now = new Date(), random = () => crypto.randomUUID()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `REC-${stamp}-${random().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}
