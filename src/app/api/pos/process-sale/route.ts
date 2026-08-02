import { NextResponse, type NextRequest } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { config } from '@/lib/config'
import { createAdminSupabase } from '@/lib/supabase/admin'

type JsonRecord = Record<string, unknown>

type RouteBody = {
  p_sale_data?: JsonRecord
  p_items?: unknown
  p_payments?: unknown
  p_session_id?: unknown
  p_price_mode?: unknown
  p_order_discount_rate?: unknown
  p_credit?: unknown
  p_repair_ids?: unknown
  p_mark_repairs_delivered?: unknown
  p_delivery_outcome?: unknown
}

type NormalizedItem = {
  product_id: string
  quantity: number
  discount_amount: number
}

type NormalizedPayment = {
  payment_method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: number
  reference: string | null
  card_last4: string | null
  provider: string | null
  institution: string | null
  channel: 'card_terminal' | 'bank_transfer' | 'qr' | null
  terminal_id: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAYMENT_METHODS = new Set<NormalizedPayment['payment_method']>(['cash', 'card', 'transfer', 'credit'])

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeItems(value: unknown): NormalizedItem[] | null {
  if (!Array.isArray(value)) return null

  const items: NormalizedItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const row = entry as JsonRecord
    const productId = typeof row.product_id === 'string' ? row.product_id.trim() : ''
    const quantity = finiteNumber(row.quantity)
    const discountAmount = finiteNumber(row.discount_amount ?? 0)

    if (!UUID_PATTERN.test(productId) || quantity === null || !Number.isInteger(quantity) || quantity <= 0) {
      return null
    }
    if (discountAmount === null || discountAmount < 0) return null

    items.push({ product_id: productId, quantity, discount_amount: discountAmount })
  }
  return items
}

export function normalizePayments(value: unknown): NormalizedPayment[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null

  const payments: NormalizedPayment[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const row = entry as JsonRecord
    const method = typeof row.payment_method === 'string'
      ? row.payment_method.trim().toLowerCase() as NormalizedPayment['payment_method']
      : null
    const amount = finiteNumber(row.amount)
    const reference = typeof row.reference === 'string' && row.reference.trim() ? row.reference.trim().slice(0, 160) : null
    const cardLast4 = typeof row.card_last4 === 'string' && row.card_last4.trim() ? row.card_last4.trim() : null
    const provider = typeof row.provider === 'string' && row.provider.trim() ? row.provider.trim().slice(0, 120) : null
    const institution = typeof row.institution === 'string' && row.institution.trim() ? row.institution.trim().slice(0, 120) : null
    const terminalId = typeof row.terminal_id === 'string' && row.terminal_id.trim() ? row.terminal_id.trim().slice(0, 80) : null
    const channel = row.channel === 'qr' || row.channel === 'bank_transfer' || row.channel === 'card_terminal'
      ? row.channel
      : null

    if (!method || !PAYMENT_METHODS.has(method) || amount === null || amount <= 0) return null
    if (method === 'transfer' && !reference) return null
    if (method === 'card' && !/^\d{4}$/.test(cardLast4 || '')) return null
    if (method === 'card' && channel && channel !== 'card_terminal') return null
    if (method === 'transfer' && channel === 'card_terminal') return null
    if ((method === 'cash' || method === 'credit') && channel) return null

    payments.push({
      payment_method: method,
      amount: Number(amount.toFixed(2)),
      reference,
      card_last4: cardLast4,
      provider,
      institution,
      channel,
      terminal_id: terminalId,
    })
  }
  return payments
}

function normalizeUuidArray(value: unknown) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const ids = [...new Set(value.map(item => typeof item === 'string' ? item.trim() : ''))]
  return ids.every(id => UUID_PATTERN.test(id)) ? ids : null
}

function normalizeCredit(value: unknown) {
  if (value === undefined || value === null) return null
  if (!value || typeof value !== 'object') return null
  const row = value as JsonRecord
  const interestRate = finiteNumber(row.interest_rate)
  const installmentCount = finiteNumber(row.installment_count)
  const frequency = row.frequency === 'weekly' || row.frequency === 'biweekly' ? row.frequency : 'monthly'
  if (interestRate === null || interestRate < 0 || interestRate > 100) return null
  if (installmentCount === null || !Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 60) return null
  return { interest_rate: interestRate, installment_count: installmentCount, frequency }
}

async function getTaxRate(
  supabase: ReturnType<typeof createAdminSupabase>,
  organizationId: string
) {
  const [{ data: globalSettings }, { data: organizationSettings }] = await Promise.all([
    supabase.from('system_settings').select('tax_rate').eq('id', 'system').maybeSingle(),
    supabase.from('organization_settings').select('modules').eq('organization_id', organizationId).maybeSingle(),
  ])

  const modules = organizationSettings?.modules
  const adminSettings = modules && typeof modules === 'object' && !Array.isArray(modules)
    ? (modules as JsonRecord).admin_settings
    : null
  const tenantTaxRate = adminSettings && typeof adminSettings === 'object'
    ? finiteNumber((adminSettings as JsonRecord).taxRate ?? (adminSettings as JsonRecord).tax_rate)
    : null
  const globalTaxRate = finiteNumber(globalSettings?.tax_rate)

  return Math.min(100, Math.max(0, tenantTaxRate ?? globalTaxRate ?? (config.taxRate * 100)))
}

function errorResponse(error: { message?: string } | null) {
  const message = error?.message || 'No se pudo completar la venta.'
  const mappings: Array<[string, string, number]> = [
    ['POS_PERMISSION_DENIED', 'No tenes permisos para procesar ventas.', 403],
    ['INVALID_POS_BRANCH', 'La sucursal seleccionada no esta disponible.', 400],
    ['CASH_REGISTER_NOT_OPEN', 'La caja seleccionada ya no esta abierta.', 409],
    ['IDEMPOTENCY_KEY_REQUIRED', 'No se pudo identificar de forma segura el intento de venta.', 400],
    ['CUSTOMER_NOT_IN_ORGANIZATION', 'El cliente seleccionado no pertenece a esta organizacion.', 400],
    ['BRANCH_INVENTORY_NOT_CONFIGURED', 'El producto no tiene inventario configurado en esta sucursal.', 409],
    ['INSUFFICIENT_STOCK', 'El stock cambio antes de confirmar la venta. Actualiza el carrito.', 409],
    ['PAYMENT_TOTAL_MISMATCH', 'Los pagos no coinciden con el total recalculado de la venta.', 409],
    ['TRANSFER_REFERENCE_REQUIRED', 'La transferencia necesita una referencia.', 400],
    ['CREDIT_CUSTOMER_REQUIRED', 'Selecciona un cliente para usar credito.', 400],
    ['CREDIT_LIMIT_EXCEEDED', 'El cliente no tiene credito disponible suficiente.', 409],
    ['REPAIR_NOT_IN_POS_SCOPE', 'Una reparacion no pertenece a la sucursal activa.', 400],
    ['REPAIR_ALREADY_PAID', 'Una de las reparaciones seleccionadas ya fue pagada.', 409],
  ]
  const match = mappings.find(([code]) => message.includes(code))
  if (match) return NextResponse.json({ success: false, error: match[1] }, { status: match[2] })

  console.error('[pos/process-sale] Atomic sale failed:', { message })
  return NextResponse.json({ success: false, error: 'No se pudo completar la venta.' }, { status: 500 })
}

export const POST = withTenantAuth(
  { permission: 'pos.sales.create', module: 'pos' },
  async (request: NextRequest, { organization, user }) => {
    let body: RouteBody
    try {
      body = await request.json() as RouteBody
    } catch {
      return NextResponse.json({ success: false, error: 'La solicitud no es valida.' }, { status: 400 })
    }

    const saleData = body.p_sale_data ?? {}
    const items = normalizeItems(body.p_items)
    const payments = normalizePayments(body.p_payments)
    const repairIds = normalizeUuidArray(body.p_repair_ids)
    const sessionId = typeof body.p_session_id === 'string' ? body.p_session_id.trim() : ''
    const customerId = typeof saleData.customer_id === 'string' && saleData.customer_id.trim()
      ? saleData.customer_id.trim()
      : null
    const idempotencyKey = request.headers.get('x-idempotency-key')?.trim().slice(0, 160) ?? ''
    const priceMode = body.p_price_mode === 'wholesale' ? 'wholesale' : 'retail'
    const orderDiscountRate = finiteNumber(body.p_order_discount_rate ?? 0)
    const credit = normalizeCredit(body.p_credit)

    if (!items || !payments || !repairIds) {
      return NextResponse.json({ success: false, error: 'Los items, pagos o reparaciones no son validos.' }, { status: 400 })
    }
    if (items.length === 0 && repairIds.length === 0) {
      return NextResponse.json({ success: false, error: 'La venta debe incluir productos o reparaciones.' }, { status: 400 })
    }
    if (!UUID_PATTERN.test(sessionId) || !idempotencyKey) {
      return NextResponse.json({ success: false, error: 'La caja y la clave de confirmacion son obligatorias.' }, { status: 400 })
    }
    if (customerId && !UUID_PATTERN.test(customerId)) {
      return NextResponse.json({ success: false, error: 'El cliente seleccionado no es valido.' }, { status: 400 })
    }
    if (payments.some(payment => payment.payment_method === 'credit') && !credit) {
      return NextResponse.json({ success: false, error: 'Configura las cuotas de la venta a credito.' }, { status: 400 })
    }
    if (orderDiscountRate === null || orderDiscountRate < 0 || orderDiscountRate > 100) {
      return NextResponse.json({ success: false, error: 'El descuento general no es valido.' }, { status: 400 })
    }

    let branchScope
    try {
      branchScope = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
        requestedBranchId: getRequestedBranchId(request),
        organizationId: organization.id,
        strict: true,
      })
    } catch {
      return NextResponse.json({ success: false, error: 'No tenes acceso a la sucursal seleccionada.' }, { status: 403 })
    }

    if (!branchScope.branchId) {
      return NextResponse.json({ success: false, error: 'Selecciona una sucursal para vender.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const taxRate = await getTaxRate(supabase, organization.id)
    const code = `POS-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const { data, error } = await supabase.rpc('process_pos_sale_atomic_v3', {
      p_organization_id: organization.id,
      p_branch_id: branchScope.branchId,
      p_actor_id: user.id,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
      p_code: code,
      p_customer_id: customerId,
      p_items: items,
      p_payments: payments,
      p_price_mode: priceMode,
      p_order_discount_rate: orderDiscountRate,
      p_notes: typeof saleData.notes === 'string' ? saleData.notes.slice(0, 2000) : null,
      p_tax_rate: taxRate,
      p_prices_include_tax: config.pricesIncludeTax,
      p_credit: credit,
      p_repair_ids: repairIds,
      p_mark_repairs_delivered: body.p_mark_repairs_delivered === true,
      p_delivery_outcome: typeof body.p_delivery_outcome === 'string' ? body.p_delivery_outcome.slice(0, 120) : null,
    })

    if (error || !data) return errorResponse(error)

    const result = data as JsonRecord
    const saleId = typeof result.sale_id === 'string' ? result.sale_id : null
    if (!saleId) return errorResponse({ message: 'INVALID_ATOMIC_SALE_RESPONSE' })

    return NextResponse.json({
      success: true,
      saleId,
      data: {
        id: saleId,
        total: finiteNumber(result.total),
        tax: finiteNumber(result.tax),
        discount: finiteNumber(result.discount),
        paymentMethod: result.payment_method,
        creditId: result.credit_id,
      },
      idempotent: result.idempotent === true,
    })
  }
)
