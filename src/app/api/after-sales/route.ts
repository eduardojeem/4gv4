import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  getAfterSalesRequestTypeAliases,
  getAfterSalesSourceTypeAliases,
  getAfterSalesStatusAliases,
  normalizeAfterSalesCase,
  type AfterSalesRequestType,
  type AfterSalesSourceType,
  type AfterSalesStatus,
} from '@/lib/after-sales/compat'

/**
 * Casos de posventa: garantias, cambios y devoluciones.
 *
 * La tabla `after_sales_cases` existia en el esquema desde 20260307 pero no
 * tenia ninguna capa de aplicacion. Esta ruta la conecta, ya acotada por
 * organizacion (ver 20260801020000_scope_after_sales_by_org.sql).
 */

const SOURCE_TYPES = ['repair', 'sale'] as const
const REQUEST_TYPES = ['repair_warranty', 'product_warranty', 'exchange', 'return'] as const
const STATUSES = ['open', 'approved', 'rejected', 'completed', 'cancelled'] as const

const createCaseSchema = z.object({
  source_type: z.enum(SOURCE_TYPES),
  request_type: z.enum(REQUEST_TYPES),
  repair_id: z.string().uuid().optional().nullable(),
  sale_id: z.string().uuid().optional().nullable(),
  sale_item_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(10000).default(1),
  reason: z.string().trim().min(1).max(1000),
  notes: z.string().trim().max(2000).optional().nullable(),
  refund_amount: z.number().min(0).optional().nullable(),
  replacement_product_id: z.string().uuid().optional().nullable(),
  replacement_quantity: z.number().int().min(1).max(10000).optional().nullable(),
  price_difference: z.number().optional().nullable(),
})
  // Replica en la aplicacion el CHECK de la tabla, para devolver un 400 con
  // mensaje claro en lugar de un 500 con el error crudo de Postgres.
  .refine((data) => data.source_type !== 'repair' || Boolean(data.repair_id), {
    message: 'Un caso originado en una reparación requiere repair_id.',
    path: ['repair_id'],
  })
  .refine((data) => data.source_type !== 'sale' || Boolean(data.sale_id), {
    message: 'Un caso originado en una venta requiere sale_id.',
    path: ['sale_id'],
  })

const SELECT_COLUMNS =
  'id, case_number, source_type, request_type, status, customer_id, repair_id, sale_id, sale_item_id, product_id, quantity, reason, notes, refund_amount, refund_method, restock_action, replacement_product_id, replacement_quantity, price_difference, generated_repair_id, approved_at, resolved_at, created_by, resolved_by, created_at, updated_at'

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))
    const status = searchParams.get('status')
    const requestType = searchParams.get('request_type')
    const sourceType = searchParams.get('source_type')
    const customerId = searchParams.get('customer_id')
    const repairId = searchParams.get('repair_id')
    const saleId = searchParams.get('sale_id')
    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabase = await createClient()
    let query = supabase
      .from('after_sales_cases')
      // Cada embed apunta por una unica FK, asi que el hint alcanza para que
      // PostgREST no tenga que adivinar la relacion.
      .select(
        `${SELECT_COLUMNS},
         repairs:repairs!repair_id(ticket_number, device_brand, device_model, warranty_type, warranty_months, warranty_expires_at, problem_description, delivered_at, final_cost),
         sales:sales!sale_id(code, total_amount, created_at),
         products:products!product_id(name, sku, image_url),
         customers:customers!customer_id(name, phone)`,
        { count: 'exact' }
      )
      .eq('organization_id', organization.id)

    if (status && status !== 'all' && (STATUSES as readonly string[]).includes(status)) {
      query = query.in('status', getAfterSalesStatusAliases(status as AfterSalesStatus))
    }
    if (requestType && requestType !== 'all' && (REQUEST_TYPES as readonly string[]).includes(requestType)) {
      query = query.in('request_type', getAfterSalesRequestTypeAliases(requestType as AfterSalesRequestType))
    }
    if (sourceType && sourceType !== 'all' && (SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      query = query.in('source_type', getAfterSalesSourceTypeAliases(sourceType as AfterSalesSourceType))
    }
    if (customerId) query = query.eq('customer_id', customerId)
    if (repairId) query = query.eq('repair_id', repairId)
    if (saleId) query = query.eq('sale_id', saleId)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const rows = data ?? []

    // `generated_repair_id` no tiene foreign key a proposito (evita la
    // ambiguedad de embeds de PostgREST), asi que el retrabajo se resuelve con
    // una segunda consulta en lugar de un embed.
    const generatedIds = Array.from(
      new Set(rows.map((row) => row.generated_repair_id).filter((value): value is string => Boolean(value)))
    )

    // `replacement_product_id` no tiene FK (misma razon que generated_repair_id),
    // asi que el producto de reemplazo se resuelve con una segunda consulta.
    const replacementIds = Array.from(
      new Set(rows.map((row) => row.replacement_product_id).filter((value): value is string => Boolean(value)))
    )

    let replacementById = new Map<string, { name: string | null; image_url: string | null }>()
    if (replacementIds.length > 0) {
      const { data: replacements } = await supabase
        .from('products')
        .select('id, name, image_url')
        .eq('organization_id', organization.id)
        .in('id', replacementIds)

      replacementById = new Map((replacements ?? []).map((row) => [row.id, { name: row.name, image_url: row.image_url }]))
    }

    let generatedById = new Map<string, { ticket_number: string | null; status: string | null }>()
    if (generatedIds.length > 0) {
      const { data: generated } = await supabase
        .from('repairs')
        // El estado del retrabajo permite avisar si el caso se cierra con el
        // equipo todavia en el taller.
        .select('id, ticket_number, status')
        .eq('organization_id', organization.id)
        .in('id', generatedIds)

      generatedById = new Map((generated ?? []).map((row) => [row.id, { ticket_number: row.ticket_number, status: row.status ?? null }]))
    }

    const enriched = rows.map((row) => normalizeAfterSalesCase({
      ...row,
      generated_repair: row.generated_repair_id ? generatedById.get(row.generated_repair_id) ?? null : null,
      replacement_product: row.replacement_product_id ? replacementById.get(row.replacement_product_id) ?? null : null,
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      },
    })
  } catch (error) {
    logger.error('After-sales API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los casos de posventa.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { user, organization }) => {
  try {
    const validation = createCaseSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'Error de validación', details: validation.error.issues },
        { status: 400 }
      )
    }

    const input = validation.data
    const supabase = await createClient()

    // El origen debe pertenecer a la organizacion: sin esto se podria abrir un
    // caso contra la venta o reparacion de otro inquilino.
    if (input.source_type === 'repair' && input.repair_id) {
      const { data: repair, error } = await supabase
        .from('repairs')
        .select('id')
        .eq('id', input.repair_id)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (error) throw error
      if (!repair) {
        return NextResponse.json({ success: false, error: 'La reparación no pertenece a tu organización.' }, { status: 404 })
      }
    }

    if (input.source_type === 'sale' && input.sale_id) {
      const { data: sale, error } = await supabase
        .from('sales')
        .select('id')
        .eq('id', input.sale_id)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (error) throw error
      if (!sale) {
        return NextResponse.json({ success: false, error: 'La venta no pertenece a tu organización.' }, { status: 404 })
      }
    }

    // Sin esto, cada click en "Reclamar garantia" abre un caso nuevo: el mismo
    // equipo terminaba con media docena de casos abiertos y, al aprobarlos,
    // media docena de retrabajos.
    const sourceColumn = input.source_type === 'repair' ? 'repair_id' : 'sale_id'
    const sourceValue = input.source_type === 'repair' ? input.repair_id : input.sale_id

    if (sourceValue) {
      let openQuery = supabase
        .from('after_sales_cases')
        .select('id, case_number, status')
        .eq('organization_id', organization.id)
        .eq(sourceColumn, sourceValue)
        // Acotado al mismo tipo: una venta puede tener a la vez una devolucion
        // y una garantia, pero no dos garantias iguales sobre lo mismo.
        .in('request_type', getAfterSalesRequestTypeAliases(input.request_type))
        .in('status', [...getAfterSalesStatusAliases('open'), ...getAfterSalesStatusAliases('approved')])

      // Y acotado a la LINEA de venta: una venta de tres productos puede tener
      // un cambio por cada uno. Sin esto, reclamar el segundo producto rebotaba
      // contra el caso del primero.
      if (input.sale_item_id) {
        openQuery = openQuery.eq('sale_item_id', input.sale_item_id)
      }

      const { data: openCase, error: openError } = await openQuery.limit(1).maybeSingle()

      if (openError) throw openError
      if (openCase) {
        return NextResponse.json(
          {
            success: false,
            error: `Ya hay un caso ${getAfterSalesStatusAliases('open').includes(String(openCase.status)) ? 'abierto' : 'aprobado'} (${openCase.case_number || openCase.id.slice(0, 8)}) de este tipo para este producto. Resolvé ese antes de abrir otro.`,
            data: openCase,
          },
          { status: 409 }
        )
      }
    }

    const { data, error: insertError } = await supabase
      .from('after_sales_cases')
      .insert({
        organization_id: organization.id,
        source_type: input.source_type,
        request_type: input.request_type,
        status: 'open',
        repair_id: input.repair_id ?? null,
        sale_id: input.sale_id ?? null,
        sale_item_id: input.sale_item_id ?? null,
        product_id: input.product_id ?? null,
        customer_id: input.customer_id ?? null,
        quantity: input.quantity,
        reason: input.reason,
        notes: input.notes || null,
        refund_amount: input.refund_amount ?? null,
        replacement_product_id: input.replacement_product_id ?? null,
        replacement_quantity: input.replacement_quantity ?? null,
        price_difference: input.price_difference ?? null,
        created_by: user.id,
      })
      .select(SELECT_COLUMNS)
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, data: normalizeAfterSalesCase(data) }, { status: 201 })
  } catch (error) {
    logger.error('After-sales API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo registrar el caso de posventa.' }, { status: 500 })
  }
})
