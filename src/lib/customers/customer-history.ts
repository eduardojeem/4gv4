import { resolveRepairCollectionPricing } from '@/lib/repairs/collection-pricing'
import type { RepairPricingMode } from '@/lib/repairs/pricing'
import { isCountableSale } from '@/lib/customers/customer-spend'

/**
 * Historial del cliente: ventas y reparaciones con su estado de pago real.
 *
 * Qué mostraba mal la ficha y por qué se calcula acá:
 *
 * - Toda venta salía «Pendiente» con botón «Abonar»: se leía `payment_status`,
 *   que la consulta ni siquiera traía (y en la base vale `completed` también en
 *   las ventas a crédito).
 * - Una reparación entregada a crédito salía «Pagado»: la entrega deja
 *   `paid_amount` igual al total y la deuda vive en las cuotas del crédito.
 * - El saldo de una reparación se calculaba con `final_cost ?? estimated_cost`,
 *   distinto del que usa el cobro (repuestos, descuento, mano de obra).
 * - Las anuladas y canceladas se mostraban como cualquier otra.
 *
 * Una sola regla, la misma que el cobro unificado, y la pantalla solo la pinta.
 */

export type HistoryPaymentState =
  /** Cobrado por completo. */
  | 'paid'
  /** Tiene una parte cobrada y queda saldo. */
  | 'partial'
  /** No se cobró nada y hay saldo. */
  | 'unpaid'
  /** Financiado con cuotas que todavía se deben. */
  | 'credit'
  /** Financiado y ya saldado. */
  | 'credit_settled'
  /** Sin monto a cobrar (sin presupuesto o sin cargo). */
  | 'no_charge'
  /** Anulada o cancelada: no se cobra ni suma. */
  | 'cancelled'

export interface CustomerHistoryItem {
  id: string
  kind: 'sale' | 'repair'
  date: string
  /** Código de venta o número de ticket. */
  reference: string
  title: string
  detail: string
  total: number
  paid: number
  /** Lo que falta cobrar. `null` cuando no se puede saber (cuenta corriente sin cuotas asociadas). */
  balance: number | null
  payment: HistoryPaymentState
  /** Deuda vencida: cuota atrasada o equipo retirado sin pagar. */
  overdue: boolean
  /** Estado crudo de la operación (`completed`, `entregado`, `listo`…). */
  status: string
  /** Solo reparaciones: el equipo ya salió del taller. */
  delivered?: boolean
  paymentMethod?: string | null
  /** Fecha de la próxima cuota impaga, si la hay. */
  nextDueDate?: string | null
  /** Total de las cuotas cuando fue financiada: con intereses puede superar al precio. */
  financedTotal?: number
}

export interface CustomerHistorySummary {
  salesCount: number
  repairsCount: number
  /** Reparaciones que siguen en el taller (ni entregadas ni canceladas). */
  repairsInShop: number
  /** Deuda exigible: ventas y reparaciones entregadas con saldo, y cuotas impagas. */
  owed: number
  /** Saldo de equipos que siguen en el taller: se cobra al retirar. */
  dueOnPickup: number
  /** Cuántas operaciones tienen saldo pendiente. */
  withBalance: number
  overdueCount: number
}

type Row = Record<string, unknown>

export interface CustomerHistorySources {
  sales: Row[]
  repairs: Row[]
  credits: Row[]
  installments: Row[]
  now?: Date
}

const CANCELLED_REPAIR = new Set(['cancelado', 'cancelled', 'canceled'])
const CANCELLED_CREDIT = new Set(['cancelled', 'canceled', 'cancelado'])
const DELIVERED_REPAIR = new Set(['entregado', 'delivered'])
const PENDING_SALE_PAYMENT = new Set(['pending', 'pendiente', 'partial', 'parcial', 'unpaid'])
const CREDIT_METHODS = new Set(['credit', 'credito', 'crédito'])

const amount = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))

/** El saldo de la reparación con la misma cuenta que usa el cobro. */
export function repairPricingFromRow(r: Row) {
  return resolveRepairCollectionPricing({
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
  }).pricing
}

type InstallmentState = { pending: number; financed: number; overdue: boolean; nextDueDate: string | null }

function installmentState(rows: Row[], today: Date): InstallmentState {
  let pending = 0
  let financed = 0
  let overdue = false
  let nextDueDate: string | null = null
  for (const inst of rows) {
    financed += amount(inst.amount)
    const due = amount(inst.amount) - amount(inst.amount_paid)
    if (text(inst.status) === 'paid' || due <= 0) continue
    pending += due
    const dueDate = inst.due_date ? new Date(text(inst.due_date)) : null
    if (text(inst.status) === 'late' || (dueDate && dueDate < today)) overdue = true
    if (inst.due_date && (!nextDueDate || text(inst.due_date) < nextDueDate)) nextDueDate = text(inst.due_date)
  }
  return { pending, financed, overdue, nextDueDate }
}

function saleItemsLabel(sale: Row) {
  const items = (sale.sale_items as Row[] | null) ?? []
  const units = items.reduce((acc, item) => acc + (amount(item.quantity) || 1), 0)
  const names = items
    .map((item) => text((item.product as Row | null)?.name))
    .filter(Boolean)
  if (names.length === 0) return units > 0 ? `${units} ${units === 1 ? 'producto' : 'productos'}` : 'Venta'
  const first = names.slice(0, 2).join(', ')
  return names.length > 2 ? `${first} y ${names.length - 2} más` : first
}

export function buildCustomerHistory(sources: CustomerHistorySources): {
  items: CustomerHistoryItem[]
  summary: CustomerHistorySummary
} {
  const today = new Date(sources.now ?? Date.now())
  today.setHours(0, 0, 0, 0)

  const credits = sources.credits.filter((c) => !CANCELLED_CREDIT.has(text(c.status).toLowerCase()))
  const creditIds = new Set(credits.map((c) => text(c.id)))
  const installments = sources.installments.filter((i) => creditIds.has(text(i.credit_id)))

  const installmentsByCredit = new Map<string, Row[]>()
  const installmentsBySale = new Map<string, Row[]>()
  for (const inst of installments) {
    const creditId = text(inst.credit_id)
    installmentsByCredit.set(creditId, [...(installmentsByCredit.get(creditId) ?? []), inst])
    const saleId = text(inst.sale_id)
    if (saleId) installmentsBySale.set(saleId, [...(installmentsBySale.get(saleId) ?? []), inst])
  }

  // Las cuotas de una venta: las que la nombran, más las de un crédito abierto
  // para esa venta que no nombran a otra.
  const saleInstallments = (saleId: string) => {
    const own = installmentsBySale.get(saleId) ?? []
    const seen = new Set(own.map((i) => text(i.id)))
    const fromCredit = credits
      .filter((c) => text(c.sale_id) === saleId)
      .flatMap((c) => installmentsByCredit.get(text(c.id)) ?? [])
      .filter((i) => !seen.has(text(i.id)) && (!i.sale_id || text(i.sale_id) === saleId))
    return [...own, ...fromCredit]
  }

  const repairCredits = new Map<string, Row[]>()
  for (const c of credits) {
    const repairId = text((c.metadata as Row | null)?.repair_id)
    if (repairId) repairCredits.set(repairId, [...(repairCredits.get(repairId) ?? []), c])
  }

  const items: CustomerHistoryItem[] = []

  for (const sale of sources.sales) {
    const id = text(sale.id)
    const total = amount(sale.total_amount ?? sale.total)
    const status = text(sale.status) || 'completed'
    const method = text(sale.payment_method) || null
    const base = {
      id,
      kind: 'sale' as const,
      date: text(sale.created_at),
      reference: text(sale.code) || id.slice(-6).toUpperCase(),
      title: 'Venta',
      detail: saleItemsLabel(sale),
      total,
      status,
      paymentMethod: method,
    }

    if (!isCountableSale(status)) {
      items.push({ ...base, paid: 0, balance: 0, payment: 'cancelled', overdue: false })
      continue
    }

    const linked = saleInstallments(id)
    if (linked.length > 0) {
      const state = installmentState(linked, today)
      items.push({
        ...base,
        paid: Math.max(0, state.financed - state.pending),
        balance: state.pending,
        financedTotal: state.financed,
        payment: state.pending > 0 ? 'credit' : 'credit_settled',
        overdue: state.overdue,
        nextDueDate: state.nextDueDate,
      })
      continue
    }

    if (CREDIT_METHODS.has((method ?? '').toLowerCase())) {
      // Cargada a una cuenta corriente sin cuotas propias: se sabe que fue a
      // crédito, no cuánto queda de esta venta en particular.
      items.push({ ...base, paid: 0, balance: null, payment: 'credit', overdue: false })
      continue
    }

    const unpaid = PENDING_SALE_PAYMENT.has(text(sale.payment_status).toLowerCase())
    items.push({
      ...base,
      paid: unpaid ? 0 : total,
      balance: unpaid ? total : 0,
      payment: unpaid ? 'unpaid' : 'paid',
      overdue: false,
    })
  }

  for (const repair of sources.repairs) {
    const id = text(repair.id)
    const status = (text(repair.status) || 'recibido').toLowerCase()
    const delivered = DELIVERED_REPAIR.has(status) || Boolean(repair.delivered_at)
    const device = [text(repair.device_brand), text(repair.device_model)].filter(Boolean).join(' ')
    const base = {
      id,
      kind: 'repair' as const,
      date: text(repair.created_at),
      reference: text(repair.ticket_number) || id.slice(-6).toUpperCase(),
      title: device || 'Reparación',
      detail: text(repair.problem_description) || 'Sin descripción',
      status,
      delivered,
    }

    if (CANCELLED_REPAIR.has(status)) {
      items.push({ ...base, total: amount(repair.final_cost ?? repair.estimated_cost), paid: amount(repair.paid_amount), balance: 0, payment: 'cancelled', overdue: false })
      continue
    }

    const pricing = repairPricingFromRow(repair)
    const financed = (repairCredits.get(id) ?? []).flatMap((c) => installmentsByCredit.get(text(c.id)) ?? [])

    if (financed.length > 0) {
      const state = installmentState(financed, today)
      const balance = state.pending + Math.max(0, pricing.balance)
      const financedTotal = Math.max(state.financed, pricing.customerTotal)
      items.push({
        ...base,
        total: pricing.customerTotal,
        paid: Math.max(0, financedTotal - balance),
        balance,
        financedTotal,
        payment: balance > 0 ? 'credit' : 'credit_settled',
        overdue: state.overdue,
        nextDueDate: state.nextDueDate,
      })
      continue
    }

    if (pricing.balance > 0) {
      items.push({
        ...base,
        total: pricing.customerTotal,
        paid: pricing.paidAmount,
        balance: pricing.balance,
        payment: pricing.paidAmount > 0 ? 'partial' : 'unpaid',
        // Retirado sin pagar ya es deuda; en el taller se cobra al entregar.
        overdue: delivered,
      })
      continue
    }

    // Reparaciones viejas guardan el precio acordado solo en `final_cost` o
    // `estimated_cost`, ya cobrado entero: el cálculo da 0 y no son «sin cargo».
    const total = pricing.customerTotal > 0
      ? pricing.customerTotal
      : Math.max(amount(repair.final_cost ?? repair.estimated_cost), pricing.paidAmount)
    items.push({
      ...base,
      total,
      paid: pricing.paidAmount,
      balance: 0,
      payment: total > 0 ? 'paid' : 'no_charge',
      overdue: false,
    })
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const summary: CustomerHistorySummary = {
    salesCount: 0,
    repairsCount: 0,
    repairsInShop: 0,
    owed: 0,
    dueOnPickup: 0,
    withBalance: 0,
    overdueCount: 0,
  }
  for (const item of items) {
    if (item.kind === 'sale') summary.salesCount += 1
    else {
      summary.repairsCount += 1
      if (!item.delivered && item.payment !== 'cancelled') summary.repairsInShop += 1
    }
    const balance = item.balance ?? 0
    if (balance > 0) {
      summary.withBalance += 1
      if (item.kind === 'repair' && !item.delivered && item.payment !== 'credit') summary.dueOnPickup += balance
      else summary.owed += balance
    }
    if (item.overdue) summary.overdueCount += 1
  }

  return { items, summary }
}
