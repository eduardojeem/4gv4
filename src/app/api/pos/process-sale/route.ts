import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

type RouteBody = {
  p_sale_data?: {
    code?: unknown
    customer_id?: unknown
    total_amount?: unknown
    subtotal_amount?: unknown
    tax_amount?: unknown
    discount_amount?: unknown
    payment_method?: unknown
    payment_status?: unknown
    notes?: unknown
    status?: unknown
    created_at?: unknown
  }
  p_items?: unknown
  p_payments?: unknown
}

type NormalizedSaleItem = {
  productId: string
  quantity: number
  unitPrice: number
  discountAmount: number
  subtotal: number
}

type ProductRow = {
  id: string
  stock_quantity: number | null
  is_active?: boolean | null
}

type BranchInventoryRow = {
  product_id: string
  stock_quantity: number | null
}

type SupabaseErrorLike = {
  code?: string | null
  details?: string | null
  hint?: string | null
  message?: string | null
  name?: string | null
  status?: number | null
  statusText?: string | null
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSaleItems(rawItems: unknown): NormalizedSaleItem[] | null {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null

  const items: NormalizedSaleItem[] = []

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') return null
    const raw = rawItem as Record<string, unknown>

    const productId = typeof raw.product_id === 'string' ? raw.product_id.trim() : ''
    const quantity = Math.floor(toFiniteNumber(raw.quantity))
    const unitPrice = toFiniteNumber(raw.unit_price)
    const discountAmount = Math.max(0, toFiniteNumber(raw.discount_amount))
    const providedSubtotal = toFiniteNumber(raw.subtotal, Number.NaN)
    const subtotal = Number.isFinite(providedSubtotal)
      ? providedSubtotal
      : Math.max(0, (unitPrice * quantity) - discountAmount)

    if (!productId || quantity <= 0 || unitPrice < 0 || subtotal < 0) {
      return null
    }

    items.push({
      productId,
      quantity,
      unitPrice,
      discountAmount,
      subtotal,
    })
  }

  return items
}

function compactRecord(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
}

function uniquePayloads(payloads: Array<Record<string, unknown>>) {
  const seen = new Set<string>()
  const unique: Array<Record<string, unknown>> = []

  for (const payload of payloads) {
    const compacted = compactRecord(payload)
    const key = JSON.stringify(Object.entries(compacted).sort(([left], [right]) => left.localeCompare(right)))
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(compacted)
  }

  return unique
}

function buildPaymentMethodVariants(value: string) {
  const normalized = value.trim().toLowerCase()

  switch (normalized) {
    case 'cash':
    case 'efectivo':
      return ['efectivo', 'cash']
    case 'card':
    case 'tarjeta':
      return ['tarjeta', 'card']
    case 'transfer':
    case 'transferencia':
      return ['transferencia', 'transfer']
    case 'mixed':
    case 'multiple':
    case 'mixto':
      return ['mixed', 'multiple', 'mixto']
    default:
      return [value]
  }
}

function buildStatusVariants(value: string) {
  const normalized = value.trim().toLowerCase()

  switch (normalized) {
    case 'completed':
    case 'completada':
      return ['completed', 'completada']
    case 'pending':
    case 'pendiente':
      return ['pending', 'pendiente']
    case 'cancelled':
    case 'canceled':
    case 'cancelada':
      return ['cancelled', 'canceled', 'cancelada']
    default:
      return [value]
  }
}

function normalizeSupabaseError(error: unknown): SupabaseErrorLike {
  if (!error || typeof error !== 'object') {
    return { message: error instanceof Error ? error.message : String(error || 'Unknown error') }
  }

  const candidate = error as SupabaseErrorLike & { error_description?: string | null }
  return {
    code: candidate.code ?? null,
    details: candidate.details ?? null,
    hint: candidate.hint ?? null,
    message: candidate.message ?? candidate.error_description ?? 'Unknown Supabase error',
    name: candidate.name ?? null,
    status: candidate.status ?? null,
    statusText: candidate.statusText ?? null,
  }
}

async function insertSaleRow(
  supabase: ReturnType<typeof createAdminSupabase>,
  payloads: Array<Record<string, unknown>>
) {
  let lastError: unknown = null

  for (const payload of uniquePayloads(payloads)) {
    const { data, error } = await supabase
      .from('sales')
      .insert(payload)
      .select('id')
      .single()

    if (!error && data?.id) {
      return { saleId: data.id as string, error: null }
    }

    lastError = error
  }

  return { saleId: null, error: lastError }
}

async function insertSaleItems(
  supabase: ReturnType<typeof createAdminSupabase>,
  saleId: string,
  items: NormalizedSaleItem[]
) {
  const attempts = [
    items.map(item => compactRecord({
      sale_id: saleId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_amount: item.discountAmount,
      subtotal: item.subtotal,
    })),
    items.map(item => compactRecord({
      sale_id: saleId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.subtotal,
    })),
    items.map(item => compactRecord({
      sale_id: saleId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.subtotal,
    })),
  ]

  let lastError: unknown = null

  for (const rows of attempts) {
    const { error } = await supabase.from('sale_items').insert(rows)
    if (!error) return null
    lastError = error
  }

  return lastError
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    if (staffAuth.role === 'tecnico') {
      return NextResponse.json(
        { error: 'Permisos insuficientes para procesar ventas POS.' },
        { status: 403 }
      )
    }

    const body = await request.json() as RouteBody
    const saleData = body.p_sale_data ?? {}
    const items = normalizeSaleItems(body.p_items)

    if (!items) {
      return NextResponse.json(
        { error: 'La venta debe incluir al menos un item válido.' },
        { status: 400 }
      )
    }

    const paymentMethod = typeof saleData.payment_method === 'string' && saleData.payment_method.trim()
      ? saleData.payment_method.trim()
      : 'cash'
    const createdAtValue = typeof saleData.created_at === 'string' ? saleData.created_at : ''
    const createdAt = createdAtValue && !Number.isNaN(new Date(createdAtValue).getTime())
      ? new Date(createdAtValue).toISOString()
      : new Date().toISOString()
    const customerId = typeof saleData.customer_id === 'string' && saleData.customer_id.trim()
      ? saleData.customer_id.trim()
      : null
    const notes = typeof saleData.notes === 'string' ? saleData.notes : ''
    const status = typeof saleData.status === 'string' && saleData.status.trim()
      ? saleData.status.trim()
      : 'completed'
    const paymentStatus = typeof saleData.payment_status === 'string' && saleData.payment_status.trim()
      ? saleData.payment_status.trim()
      : 'completed'
    const subtotalAmount = toFiniteNumber(
      saleData.subtotal_amount,
      items.reduce((sum, item) => sum + item.subtotal, 0)
    )
    const discountAmount = toFiniteNumber(
      saleData.discount_amount,
      items.reduce((sum, item) => sum + item.discountAmount, 0)
    )
    const taxAmount = toFiniteNumber(saleData.tax_amount, 0)
    const totalAmount = toFiniteNumber(saleData.total_amount, subtotalAmount + taxAmount)
    const code = typeof saleData.code === 'string' && saleData.code.trim()
      ? saleData.code.trim()
      : `POS-${Date.now()}`
    const paymentMethodVariants = buildPaymentMethodVariants(paymentMethod)
    const statusVariants = buildStatusVariants(status)
    const paymentStatusVariants = buildStatusVariants(paymentStatus)
    const requestedBranchId = getRequestedBranchId(request)
    const branchScope = await resolveBranchScopeForUser({
      userId: staffAuth.user.id,
      role: staffAuth.role,
      requestedBranchId,
      strict: Boolean(requestedBranchId),
    })

    if (!branchScope.branchId) {
      return NextResponse.json(
        { error: 'No hay una sucursal operativa disponible para registrar la venta.' },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabase()
    const productIds = [...new Set(items.map(item => item.productId))]
    const requestedQuantities = items.reduce((acc, item) => {
      acc.set(item.productId, (acc.get(item.productId) || 0) + item.quantity)
      return acc
    }, new Map<string, number>())
    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('id, stock_quantity, is_active')
      .in('id', productIds)

    let branchInventoryRows: BranchInventoryRow[] = []
    try {
      const { data: branchInventoryData, error: branchInventoryError } = await supabase
        .from('branch_inventory')
        .select('product_id, stock_quantity')
        .eq('branch_id', branchScope.branchId)
        .in('product_id', productIds)

      if (!branchInventoryError) {
        branchInventoryRows = (branchInventoryData ?? []) as BranchInventoryRow[]
      }
    } catch {
      branchInventoryRows = []
    }

    if (productError) {
      console.error('[pos/process-sale] Error fetching products:', normalizeSupabaseError(productError))
      return NextResponse.json(
        { error: 'No se pudo validar el stock de la venta.' },
        { status: 500 }
      )
    }

    const productsMap = new Map(
      ((productRows as ProductRow[] | null) ?? []).map(product => [product.id, product])
    )
    const branchInventoryMap = new Map(
      branchInventoryRows.map((row) => [row.product_id, Number(row.stock_quantity || 0)])
    )

    for (const [productId, requestedQuantity] of requestedQuantities.entries()) {
      const product = productsMap.get(productId)

      if (!product) {
        return NextResponse.json(
          { error: 'Uno de los productos de la venta ya no existe.' },
          { status: 400 }
        )
      }

      if (product.is_active === false) {
        return NextResponse.json(
          { error: 'Uno de los productos seleccionados está inactivo.' },
          { status: 400 }
        )
      }

      const currentStock = Number(product.stock_quantity || 0)
      const branchStock = branchInventoryMap.has(productId)
        ? Number(branchInventoryMap.get(productId) || 0)
        : currentStock

      if (requestedQuantity > branchStock) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${productId}. Disponible en sucursal: ${branchStock}.` },
          { status: 400 }
        )
      }
    }

    const salePayloadAttempts: Array<Record<string, unknown>> = []

    for (const paymentMethodVariant of paymentMethodVariants) {
      for (const statusVariant of statusVariants) {
        for (const paymentStatusVariant of paymentStatusVariants) {
          salePayloadAttempts.push({
            code,
            customer_id: customerId,
            created_by: staffAuth.user.id,
            branch_id: branchScope.branchId,
            subtotal_amount: subtotalAmount,
            total_amount: totalAmount,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            payment_method: paymentMethodVariant,
            payment_status: paymentStatusVariant,
            status: statusVariant,
            notes,
            created_at: createdAt,
          })

          salePayloadAttempts.push({
            code,
            customer_id: customerId,
            branch_id: branchScope.branchId,
            subtotal_amount: subtotalAmount,
            total_amount: totalAmount,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            payment_method: paymentMethodVariant,
            payment_status: paymentStatusVariant,
            status: statusVariant,
            notes,
            created_at: createdAt,
          })

          salePayloadAttempts.push({
            sale_number: code,
            customer_id: customerId,
            user_id: staffAuth.user.id,
            branch_id: branchScope.branchId,
            total: totalAmount,
            tax: taxAmount,
            discount: discountAmount,
            payment_method: paymentMethodVariant,
            status: statusVariant,
            created_at: createdAt,
          })

          salePayloadAttempts.push({
            sale_number: code,
            customer_id: customerId,
            branch_id: branchScope.branchId,
            total: totalAmount,
            tax: taxAmount,
            discount: discountAmount,
            payment_method: paymentMethodVariant,
            status: statusVariant,
            created_at: createdAt,
          })

          salePayloadAttempts.push({
            customer_id: customerId,
            user_id: staffAuth.user.id,
            branch_id: branchScope.branchId,
            total: totalAmount,
            tax: taxAmount,
            discount: discountAmount,
            payment_method: paymentMethodVariant,
            status: statusVariant,
            created_at: createdAt,
          })

          salePayloadAttempts.push({
            customer_id: customerId,
            branch_id: branchScope.branchId,
            total_amount: totalAmount,
            payment_method: paymentMethodVariant,
            status: statusVariant,
            notes,
            created_at: createdAt,
          })

          if (customerId) {
            salePayloadAttempts.push({
              code,
              created_by: staffAuth.user.id,
              branch_id: branchScope.branchId,
              subtotal_amount: subtotalAmount,
              total_amount: totalAmount,
              tax_amount: taxAmount,
              discount_amount: discountAmount,
              payment_method: paymentMethodVariant,
              payment_status: paymentStatusVariant,
              status: statusVariant,
              notes,
              created_at: createdAt,
            })

            salePayloadAttempts.push({
              sale_number: code,
              user_id: staffAuth.user.id,
              branch_id: branchScope.branchId,
              total: totalAmount,
              tax: taxAmount,
              discount: discountAmount,
              payment_method: paymentMethodVariant,
              status: statusVariant,
              created_at: createdAt,
            })
          }
        }
      }
    }

    const { saleId, error: saleInsertError } = await insertSaleRow(supabase, salePayloadAttempts)

    if (!saleId) {
      const normalizedError = normalizeSupabaseError(saleInsertError)
      console.error('[pos/process-sale] Error creating sale:', normalizedError)
      return NextResponse.json(
        { error: normalizedError.message || 'No se pudo crear la venta en la base de datos.' },
        { status: 500 }
      )
    }

    const saleItemsError = await insertSaleItems(supabase, saleId, items)
    if (saleItemsError) {
      console.error('[pos/process-sale] Error creating sale items:', normalizeSupabaseError(saleItemsError))
      await supabase.from('sales').delete().eq('id', saleId)

      return NextResponse.json(
        { error: 'No se pudieron registrar los items de la venta.' },
        { status: 500 }
      )
    }

    const previousStocks: Array<{ productId: string; stock: number; branchStock: number }> = []

    for (const [productId, requestedQuantity] of requestedQuantities.entries()) {
      const product = productsMap.get(productId)
      const currentStock = Number(product?.stock_quantity || 0)
      const nextStock = Math.max(0, currentStock - requestedQuantity)
      const branchCurrentStock = branchInventoryMap.has(productId)
        ? Number(branchInventoryMap.get(productId) || 0)
        : currentStock
      const nextBranchStock = Math.max(0, branchCurrentStock - requestedQuantity)

      const { error: stockError } = await supabase
        .from('products')
        .update({ stock_quantity: nextStock })
        .eq('id', productId)

      if (stockError) {
        console.error('[pos/process-sale] Error updating stock:', normalizeSupabaseError(stockError))

        for (const snapshot of previousStocks) {
          await supabase
            .from('products')
            .update({ stock_quantity: snapshot.stock })
            .eq('id', snapshot.productId)

          await supabase
            .from('branch_inventory')
            .upsert({
              branch_id: branchScope.branchId,
              product_id: snapshot.productId,
              stock_quantity: snapshot.branchStock,
            }, {
              onConflict: 'branch_id,product_id',
            })
        }

        await supabase.from('sale_items').delete().eq('sale_id', saleId)
        await supabase.from('sales').delete().eq('id', saleId)

        return NextResponse.json(
          { error: 'No se pudo actualizar el stock de los productos vendidos.' },
          { status: 500 }
        )
      }

      if (branchScope.branchId) {
        const { error: branchInventoryError } = await supabase
          .from('branch_inventory')
          .upsert({
            branch_id: branchScope.branchId,
            product_id: productId,
            stock_quantity: nextBranchStock,
          }, {
            onConflict: 'branch_id,product_id',
          })

        if (branchInventoryError) {
          console.error('[pos/process-sale] Error updating branch stock:', normalizeSupabaseError(branchInventoryError))

          await supabase
            .from('products')
            .update({ stock_quantity: currentStock })
            .eq('id', productId)

          for (const snapshot of previousStocks) {
            await supabase
              .from('products')
              .update({ stock_quantity: snapshot.stock })
              .eq('id', snapshot.productId)

            await supabase
              .from('branch_inventory')
              .upsert({
                branch_id: branchScope.branchId,
                product_id: snapshot.productId,
                stock_quantity: snapshot.branchStock,
              }, {
                onConflict: 'branch_id,product_id',
              })
          }

          await supabase.from('sale_items').delete().eq('sale_id', saleId)
          await supabase.from('sales').delete().eq('id', saleId)

          return NextResponse.json(
            { error: 'No se pudo sincronizar el stock de la sucursal para los productos vendidos.' },
            { status: 500 }
          )
        }
      }

      previousStocks.push({ productId, stock: currentStock, branchStock: branchCurrentStock })
    }

    return NextResponse.json({
      success: true,
      saleId,
      data: { id: saleId },
    })
  } catch (error) {
    console.error('[pos/process-sale] Unhandled error:', normalizeSupabaseError(error))
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
