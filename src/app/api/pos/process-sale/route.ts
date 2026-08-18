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
  p_store_credit_amount?: unknown
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

export function normalizePayments(value: unknown, allowEmpty = false): NormalizedPayment[] | null {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > 10) return null

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

function errorResponse(error: { message?: string; details?: string; hint?: string; code?: string } | null) {
  const rawMessage = error?.message || ''
  const details = error?.details || ''
  const hint = error?.hint || ''
  const fullText = `${rawMessage} ${details} ${hint}`.trim()

  if (!fullText) {
    return NextResponse.json({ success: false, error: 'No se pudo completar la venta. Verifique los datos de la transacción.' }, { status: 500 })
  }

  // Errores con parámetros dinámicos (stock, inventario, pagos)
  if (fullText.includes('INSUFFICIENT_STOCK')) {
    const parts = fullText.split('|')
    const available = parts[2] ? parts[2].trim() : null
    const errorMsg = available !== null 
      ? `Stock insuficiente en la sucursal para uno de los productos (Disponible: ${available} un.).`
      : 'Stock insuficiente para uno de los productos en esta sucursal.'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 409 })
  }

  if (fullText.includes('BRANCH_INVENTORY_NOT_CONFIGURED')) {
    return NextResponse.json({ success: false, error: 'Uno de los productos no tiene inventario configurado en esta sucursal.' }, { status: 409 })
  }

  if (fullText.includes('PAYMENT_TOTAL_MISMATCH')) {
    const parts = fullText.split('|')
    const expected = parts[1] ? parts[1].trim() : null
    const received = parts[2] ? parts[2].trim() : null
    const errorMsg = expected && received
      ? `Los pagos ingresados (${received}) no coinciden con el total recalculado (${expected}).`
      : 'Los pagos ingresados no coinciden con el total de la venta.'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 409 })
  }

  if (fullText.includes('STORE_CREDIT_EXCEEDS_BALANCE')) {
    const parts = fullText.split('|')
    const available = parts[1] ? parts[1].trim() : null
    const errorMsg = available
      ? `El saldo a favor supera el disponible del cliente (Disponible: ${available}).`
      : 'El saldo a favor supera el disponible del cliente.'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 409 })
  }

  const mappings: Array<[string, string, number]> = [
    ['POS_PERMISSION_DENIED', 'No tenés permisos para procesar ventas en esta sucursal.', 403],
    ['INVALID_POS_BRANCH', 'La sucursal seleccionada no está disponible o está inactiva.', 400],
    ['CASH_REGISTER_NOT_OPEN', 'La caja registradora está cerrada o la sesión expiró. Abrí la caja para continuar.', 409],
    ['IDEMPOTENCY_KEY_REQUIRED', 'No se pudo identificar de forma segura el intento de venta.', 400],
    ['CUSTOMER_NOT_IN_ORGANIZATION', 'El cliente seleccionado no pertenece a esta organización.', 400],
    ['TRANSFER_REFERENCE_REQUIRED', 'La transferencia bancaria requiere un número de referencia o comprobante.', 400],
    ['INVALID_CARD_REFERENCE', 'La tarjeta requiere los 4 dígitos finales válidos.', 400],
    ['INVALID_POS_PAYMENT', 'El método o monto de pago no es válido.', 400],
    ['PAYMENTS_REQUIRED', 'Debés ingresar al menos una forma de pago para confirmar.', 400],
    ['INVALID_ORDER_QUANTITY', 'La cantidad de productos debe ser mayor a 0.', 400],
    ['PRODUCT_NOT_IN_ORGANIZATION', 'Uno de los productos no pertenece a esta organización.', 400],
    ['POS_TOTAL_MUST_BE_POSITIVE', 'El total de la venta debe ser mayor a 0.', 400],
    ['CREDIT_CUSTOMER_REQUIRED', 'Seleccioná un cliente para registrar una venta a crédito.', 400],
    ['CREDIT_LIMIT_EXCEEDED', 'El cliente no tiene límite de crédito suficiente disponible.', 409],
    ['STORE_CREDIT_CUSTOMER_REQUIRED', 'Seleccioná un cliente para utilizar saldo a favor.', 400],
    ['STORE_CREDIT_EXCEEDS_SALE_TOTAL', 'El saldo a favor no puede superar el total de la venta.', 400],
    ['STORE_CREDIT_SALE_CUSTOMER_MISMATCH', 'El saldo a favor no pertenece al cliente seleccionado.', 409],
    ['REPAIR_NOT_IN_POS_SCOPE', 'Una de las reparaciones no pertenece a la sucursal activa.', 400],
    ['REPAIR_ALREADY_PAID', 'Una de las reparaciones seleccionadas ya fue cobrada previamente.', 409],
    // Sin estos dos la venta fallaba con un 500 y el codigo crudo en pantalla,
    // cuando en realidad son situaciones previsibles del mostrador.
    ['REPAIR_DELIVERY_INVALID_STATE', 'Solo se puede entregar una reparación que esté en estado "Listo para entrega". Cobrala sin marcar la entrega, o cambiá el estado primero.', 422],
    ['REPAIR_ALREADY_DELIVERED', 'Una de las reparaciones seleccionadas ya fue entregada.', 409],
    ['INVALID_ATOMIC_SALE_RESPONSE', 'Error en el servidor al generar el comprobante de venta.', 500],
  ]

  const match = mappings.find(([code]) => fullText.includes(code))
  if (match) return NextResponse.json({ success: false, error: match[1] }, { status: match[2] })

  console.error('[pos/process-sale] Atomic sale failed:', { rawMessage, details, hint, code: error?.code })

  // Un codigo sin traducir no le dice nada a quien esta en el mostrador. Se
  // separa el codigo tecnico del mensaje: la persona entiende que hacer y el
  // codigo queda disponible para reportarlo.
  const bareCode = rawMessage?.trim().match(/^[A-Z][A-Z0-9_]{4,}$/)?.[0] ?? null
  const fallbackError = bareCode
    ? `La venta no se pudo registrar por una validación del sistema (${bareCode}). No se cobró nada. Revisá el estado de las reparaciones y del cliente, o pasá este código a soporte.`
    : rawMessage
      ? `No se pudo registrar la venta: ${rawMessage}`
      : 'No se pudo completar la venta. Verificá los datos de la transacción.'

  return NextResponse.json({ 
    success: false, 
    code: bareCode,
    error: fallbackError 
  }, { status: 500 })
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
    const requestedStoreCreditAmount = finiteNumber(body.p_store_credit_amount ?? 0)
    const payments = normalizePayments(body.p_payments, requestedStoreCreditAmount !== null && requestedStoreCreditAmount > 0)
    const repairIds = normalizeUuidArray(body.p_repair_ids)
    const sessionId = typeof body.p_session_id === 'string' ? body.p_session_id.trim() : ''
    const customerId = typeof saleData.customer_id === 'string' && saleData.customer_id.trim()
      ? saleData.customer_id.trim()
      : null
    const idempotencyKey = request.headers.get('x-idempotency-key')?.trim().slice(0, 160) ?? ''
    const priceMode = body.p_price_mode === 'wholesale' ? 'wholesale' : 'retail'
    const orderDiscountRate = finiteNumber(body.p_order_discount_rate ?? 0)
    const credit = normalizeCredit(body.p_credit)
    const storeCreditAmount = requestedStoreCreditAmount

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
    if (storeCreditAmount === null || storeCreditAmount < 0) {
      return NextResponse.json({ success: false, error: 'El saldo a favor aplicado no es valido.' }, { status: 400 })
    }
    if (storeCreditAmount > 0 && !customerId) {
      return NextResponse.json({ success: false, error: 'Selecciona un cliente para usar saldo a favor.' }, { status: 400 })
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
    
    let rpcResponse = await supabase.rpc('process_pos_sale_atomic_v4', {
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
      p_store_credit_amount: storeCreditAmount,
    })

    // Fallback a v3 si v4 aún no está cargada en la base de datos y no se utilizó saldo a favor
    if (rpcResponse.error && (rpcResponse.error.message?.includes('process_pos_sale_atomic_v4') || rpcResponse.error.code === '42883')) {
      rpcResponse = await supabase.rpc('process_pos_sale_atomic_v3', {
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
    }

    const { data, error } = rpcResponse

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
