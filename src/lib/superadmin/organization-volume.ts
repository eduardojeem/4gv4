import { stageToStatus } from '@/lib/repairs/mapping'

/**
 * De donde viene la actividad de una organizacion, y cuanto pago por el
 * servicio.
 *
 * El expediente mostraba un unico numero de ventas y un conteo pelado de
 * reparaciones. No habia forma de saber si la empresa vende por mostrador o por
 * la tienda online, cuantos equipos tiene en el taller, ni si alguna vez pago
 * una factura del plan que tiene asignado.
 */

const numero = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const masReciente = (actual: string | null, candidato: unknown): string | null => {
  if (typeof candidato !== 'string' || !candidato) return actual
  return !actual || candidato > actual ? candidato : actual
}

// ── Tienda online ───────────────────────────────────────────────────────────

export interface OrderLike {
  status?: string | null
  payment_status?: string | null
  total?: number | null
  created_at?: string | null
}

export interface OnlineSummary {
  /** Pedidos registrados, incluidos los cancelados. */
  total: number
  /** Pedidos con el pago confirmado. */
  paid: number
  /** Facturado por la tienda online: solo los pagados. */
  revenue: number
  /** Pedidos cobrados a medias: ni pagados ni sin pagar. */
  partial: number
  /** Pedidos abiertos: entraron y todavia no se entregaron ni se cancelaron. */
  open: number
  cancelled: number
  lastOrderAt: string | null
}

const PEDIDO_ABIERTO = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'])

export function summarizeOnlineOrders(orders: OrderLike[]): OnlineSummary {
  let paid = 0
  let revenue = 0
  let partial = 0
  let open = 0
  let cancelled = 0
  let lastOrderAt: string | null = null

  for (const order of orders) {
    const estado = String(order.status ?? '').toUpperCase()
    const pago = String(order.payment_status ?? '').toUpperCase()

    // `PARTIAL` no se suma: un pedido cobrado a medias no facturo su total, y
    // sumarlo entero inflaria la facturacion online.
    if (pago === 'PAID') {
      paid += 1
      revenue += numero(order.total)
    } else if (pago === 'PARTIAL') {
      partial += 1
    }

    if (estado === 'CANCELLED') cancelled += 1
    else if (PEDIDO_ABIERTO.has(estado)) open += 1

    lastOrderAt = masReciente(lastOrderAt, order.created_at)
  }

  return { total: orders.length, paid, revenue, partial, open, cancelled, lastOrderAt }
}

// ── Taller ──────────────────────────────────────────────────────────────────

export interface RepairLike {
  status?: string | null
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
  created_at?: string | null
  delivered_at?: string | null
}

export interface RepairSummary {
  total: number
  /** Equipos que siguen en el taller. */
  open: number
  completed: number
  cancelled: number
  /**
   * Cobrado por reparaciones. Cuidado: lo que se cobra por mostrador tambien
   * genera una venta, asi que este importe YA esta contado dentro del punto de
   * venta. No se suma a la facturacion.
   */
  collected: number
  /** Trabajo terminado que todavia no se cobro. */
  pendingBalance: number
  lastRepairAt: string | null
}

export function summarizeRepairs(repairs: RepairLike[]): RepairSummary {
  let open = 0
  let completed = 0
  let cancelled = 0
  let collected = 0
  let pendingBalance = 0
  let lastRepairAt: string | null = null

  for (const repair of repairs) {
    // Se reusa el normalizador del modulo: la columna guarda los estados en
    // castellano y en ingles segun la epoca en que se cargo la fila.
    const estado = stageToStatus(repair.status as never)

    if (estado === 'cancelled') cancelled += 1
    else if (estado === 'completed') completed += 1
    else open += 1

    const cobrado = numero(repair.paid_amount)
    collected += cobrado

    if (estado === 'completed') {
      // `final_cost` es el precio cerrado; el presupuesto solo se usa si nunca
      // se cerro el precio.
      const precio = repair.final_cost != null ? numero(repair.final_cost) : numero(repair.estimated_cost)
      pendingBalance += Math.max(0, precio - cobrado)
    }

    lastRepairAt = masReciente(lastRepairAt, repair.created_at)
  }

  return {
    total: repairs.length,
    open,
    completed,
    cancelled,
    collected,
    pendingBalance,
    lastRepairAt,
  }
}

// ── Lo que la organizacion pago por el servicio ─────────────────────────────

export interface PaymentLike {
  amount?: number | null
  currency?: string | null
  status?: string | null
  payment_method?: string | null
  provider?: string | null
  plan_id?: string | null
  paid_at?: string | null
  created_at?: string | null
}

export interface BillingSummary {
  /** Total efectivamente cobrado por el servicio. */
  paidTotal: number
  paidCount: number
  pendingCount: number
  failedCount: number
  refundedCount: number
  lastPaidAt: string | null
  lastPaidAmount: number | null
  lastPaidMethod: string | null
  /** Moneda de los pagos cobrados. `null` si no hay ninguno. */
  currency: string | null
  /** Se cobro en mas de una moneda: sumarlas daria un numero sin significado. */
  mixedCurrency: boolean
}

export function summarizeSubscriptionPayments(payments: PaymentLike[]): BillingSummary {
  let paidTotal = 0
  let paidCount = 0
  let pendingCount = 0
  let failedCount = 0
  let refundedCount = 0
  let lastPaidAt: string | null = null
  let lastPaidAmount: number | null = null
  let lastPaidMethod: string | null = null
  const monedas = new Set<string>()

  for (const payment of payments) {
    const estado = String(payment.status ?? '').toLowerCase()

    if (estado === 'pending') pendingCount += 1
    if (estado === 'failed') failedCount += 1
    if (estado === 'refunded') refundedCount += 1
    if (estado !== 'paid') continue

    paidCount += 1
    paidTotal += numero(payment.amount)
    monedas.add(String(payment.currency ?? 'PYG').toUpperCase())

    // `paid_at` puede faltar en cargas manuales viejas: se cae a `created_at`
    // en vez de descartar el pago.
    const fecha = payment.paid_at ?? payment.created_at ?? null
    if (typeof fecha === 'string' && (!lastPaidAt || fecha > lastPaidAt)) {
      lastPaidAt = fecha
      lastPaidAmount = numero(payment.amount)
      lastPaidMethod = payment.payment_method ?? payment.provider ?? null
    }
  }

  return {
    paidTotal,
    paidCount,
    pendingCount,
    failedCount,
    refundedCount,
    lastPaidAt,
    lastPaidAmount,
    lastPaidMethod,
    currency: monedas.size === 1 ? [...monedas][0] : paidCount > 0 ? 'PYG' : null,
    mixedCurrency: monedas.size > 1,
  }
}

/**
 * Cuantos meses lleva la cuenta contra cuantos pagos registro. Un plan pago sin
 * un solo pago cobrado es exactamente lo que un superadmin necesita ver, y no
 * se veia en ninguna pantalla.
 */
export function billingCoverage(
  monthlyPrice: number | null | undefined,
  paidTotal: number,
  ageDays: number | null
): { expectedMonths: number | null; paidMonths: number | null; behind: boolean } {
  const precio = Number(monthlyPrice ?? 0)
  if (!Number.isFinite(precio) || precio <= 0 || ageDays === null) {
    return { expectedMonths: null, paidMonths: null, behind: false }
  }

  const expectedMonths = Math.max(1, Math.floor(ageDays / 30))
  const paidMonths = Math.floor(paidTotal / precio)
  return { expectedMonths, paidMonths, behind: paidMonths < expectedMonths }
}
