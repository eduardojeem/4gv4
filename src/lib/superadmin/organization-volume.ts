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

// ── Creditos y cuotas ───────────────────────────────────────────────────────

export interface CreditLike {
  id?: string | null
  status?: string | null
  /** `sale` | `repair` | `manual` | `migration` | `refinancing` */
  origin_type?: string | null
  principal?: number | null
  term_months?: number | null
  interest_rate?: number | null
  start_date?: string | null
  created_at?: string | null
}

export interface InstallmentLike {
  status?: string | null
  amount?: number | null
  amount_paid?: number | null
  due_date?: string | null
}

export interface CreditSummary {
  /** Creditos otorgados, en cualquier estado. */
  total: number
  active: number
  completed: number
  /** Marcados como incobrables. */
  defaulted: number
  cancelled: number
  /** Capital prestado, sin intereses. */
  principal: number
  /** Lo que falta cobrar, cuota por cuota. */
  outstanding: number
  /** Cuotas que ya vencieron y siguen sin pagarse. */
  overdueInstallments: number
  /** Importe de esas cuotas. */
  overdueAmount: number
  /**
   * De donde salio cada credito. Sin esto, un capital prestado de 750.000
   * junto a un facturado de 50.000 parece una contradiccion: no lo es si el
   * credito financio una reparacion o es una linea manual, porque esos no
   * generan una venta en el mostrador.
   */
  byOrigin: Record<string, number>
  /** Plazo promedio en meses de los creditos otorgados. */
  averageTerm: number | null
  lastCreditAt: string | null
  /** No se pudieron leer todas las cuotas: el saldo es parcial. */
  installmentsTruncated: boolean
}

const CUOTA_PENDIENTE = new Set(['pending', 'late'])

export function summarizeCredits(
  credits: CreditLike[],
  installments: InstallmentLike[],
  now: number = Date.now(),
  installmentsTruncated = false
): CreditSummary {
  let active = 0
  let completed = 0
  let defaulted = 0
  let cancelled = 0
  let principal = 0
  let plazoTotal = 0
  let plazoCuenta = 0
  let lastCreditAt: string | null = null
  const byOrigin: Record<string, number> = {}

  for (const credit of credits) {
    // La columna tiene default y check constraint desde
    // 20260616000000_split_customer_credits_by_sale: una fila sin valor es de
    // antes de esa migracion.
    const origen = String(credit.origin_type ?? 'sin_clasificar').toLowerCase()
    byOrigin[origen] = (byOrigin[origen] ?? 0) + 1

    switch (String(credit.status ?? '').toLowerCase()) {
      case 'active': active += 1; break
      case 'completed': completed += 1; break
      case 'defaulted': defaulted += 1; break
      case 'cancelled': cancelled += 1; break
    }

    principal += numero(credit.principal)

    const plazo = numero(credit.term_months)
    if (plazo > 0) {
      plazoTotal += plazo
      plazoCuenta += 1
    }

    lastCreditAt = masReciente(lastCreditAt, credit.start_date ?? credit.created_at)
  }

  let outstanding = 0
  let overdueInstallments = 0
  let overdueAmount = 0

  for (const cuota of installments) {
    const estado = String(cuota.status ?? '').toLowerCase()
    if (!CUOTA_PENDIENTE.has(estado)) continue

    // El saldo de la cuota, no su importe entero: una cuota abonada a medias no
    // debe contar completa. Es la misma regla que `sumInstallmentsOutstanding`
    // usa para decidir si se aprueba una venta a credito.
    const importe = numero(cuota.amount)
    const pagado = Math.min(importe, numero(cuota.amount_paid))
    const saldo = Math.max(0, importe - pagado)
    outstanding += saldo

    // Una cuota `pending` cuyo vencimiento ya paso esta vencida aunque nadie
    // haya corrido el proceso que la marca `late`. Contar solo las `late`
    // subestimaria la mora.
    const vencida =
      estado === 'late' ||
      (typeof cuota.due_date === 'string' && new Date(cuota.due_date).getTime() < now)

    if (vencida && saldo > 0) {
      overdueInstallments += 1
      overdueAmount += saldo
    }
  }

  return {
    total: credits.length,
    active,
    completed,
    defaulted,
    cancelled,
    principal,
    outstanding,
    overdueInstallments,
    overdueAmount,
    byOrigin,
    averageTerm: plazoCuenta > 0 ? Math.round(plazoTotal / plazoCuenta) : null,
    lastCreditAt,
    installmentsTruncated,
  }
}

export const CREDIT_ORIGIN_LABELS: Record<string, string> = {
  sale: 'venta',
  repair: 'taller',
  manual: 'manual',
  migration: 'migrado',
  refinancing: 'refinanciado',
  sin_clasificar: 'sin clasificar',
}

/** «2 de venta · 1 de taller», para decir de donde sale la cartera. */
export function describeCreditOrigins(byOrigin: Record<string, number>): string | null {
  const partes = Object.entries(byOrigin)
    .filter(([, cantidad]) => cantidad > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([origen, cantidad]) => `${cantidad} de ${CREDIT_ORIGIN_LABELS[origen] ?? origen}`)

  return partes.length > 0 ? partes.join(' · ') : null
}
