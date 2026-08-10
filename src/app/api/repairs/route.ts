import { NextRequest, NextResponse } from 'next/server'
import { canCreateRepair } from '@/lib/saas/subscription-service'
import { logger } from '@/lib/logger'
import { parseCreateRepairInput, type CreateRepairInput } from '@/lib/repairs/create-repair-input'
import { RepairPartsStockError, replaceRepairPartsWithInventory } from '@/lib/repairs/replace-parts'
import { RepairPricingWriteError, resolveRepairPricingWrite } from '@/lib/repairs/pricing-write'
import {
  isNextResponse,
  resolveRepairRouteContext,
  type RepairRouteContext,
} from '@/app/api/repairs/_lib'

const REPAIR_SELECT_VARIANTS = [
  `
    *,
    customer:customers!customer_id(id, customer_code, name, first_name, last_name, phone, email),
    technician:profiles!technician_id(id, full_name),
    images:repair_images(id, image_url, description)
  `,
  `
    *,
    customer:customers!customer_id(id, name, phone, email),
    technician:profiles!technician_id(id, full_name),
    images:repair_images(id, image_url, description)
  `,
  `
    *,
    customer:customers!customer_id(id, first_name, last_name, phone, email),
    technician:profiles!technician_id(id, full_name),
    images:repair_images(id, image_url, description)
  `,
]

const FULL_REPAIR_SELECT = `
  *,
  customer:customers!customer_id(id, name, phone, email),
  technician:profiles!technician_id(id, full_name),
  images:repair_images(id, image_url, description),
  parts:repair_parts(*),
  notes:repair_notes(*)
`

type SupabaseError = { message?: string; code?: string; details?: string; hint?: string }

function validationErrorResponse(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return NextResponse.json(
    {
      error: 'Revisa los datos de la reparacion e intenta de nuevo.',
      code: 'INVALID_REPAIR_INPUT',
      fields: issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  )
}

async function validateRepairRelations(
  supabase: RepairRouteContext['supabase'],
  input: CreateRepairInput,
  organizationId: string,
  branchId: string
) {
  const customerResult = await supabase
    .from('customers')
    .select('id')
    .eq('id', input.customer_id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (customerResult.error) throw customerResult.error
  if (!customerResult.data) return 'El cliente seleccionado no pertenece a la organizacion activa.'

  if (input.technician_id) {
    const [memberResult, assignmentResult] = await Promise.all([
      supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', input.technician_id)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('user_branch_assignments')
        .select('user_id')
        .eq('branch_id', branchId)
        .eq('user_id', input.technician_id)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (memberResult.error) throw memberResult.error
    if (assignmentResult.error) throw assignmentResult.error
    if (!memberResult.data || !assignmentResult.data) {
      return 'El tecnico seleccionado no esta activo en esta sucursal.'
    }
  }

  const productIds = [...new Set(input.parts.flatMap((part) => part.product_id ? [part.product_id] : []))]
  if (productIds.length > 0) {
    const [productsResult, inventoryResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, purchase_price')
        .eq('organization_id', organizationId)
        .in('id', productIds),
      supabase
        .from('branch_inventory')
        .select('product_id')
        .eq('branch_id', branchId)
        .in('product_id', productIds),
    ])

    if (productsResult.error) throw productsResult.error
    if (inventoryResult.error) throw inventoryResult.error

    const organizationProducts = new Set((productsResult.data ?? []).map((row) => row.id))
    const branchProducts = new Set((inventoryResult.data ?? []).map((row) => row.product_id))
    if (productIds.some((id) => !organizationProducts.has(id) || !branchProducts.has(id))) {
      return 'Uno de los repuestos seleccionados no pertenece al inventario de esta sucursal.'
    }

    const purchaseCosts = new Map((productsResult.data ?? []).map((row) => [row.id, Number(row.purchase_price) || 0]))
    for (const part of input.parts) {
      if (part.product_id) part.unit_cost = purchaseCosts.get(part.product_id) ?? 0
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.create')
    if (isNextResponse(ctx)) return ctx

    const parsed = parseCreateRepairInput(await request.json())
    if (!parsed.success) return validationErrorResponse(parsed.error.issues)

    const input = parsed.data
    const { parts, notes, images, ...repairFields } = input

    const relationError = await validateRepairRelations(
      ctx.supabase,
      input,
      ctx.organizationId,
      ctx.branchId
    )
    if (relationError) {
      return NextResponse.json(
        { error: relationError, code: 'INVALID_REPAIR_RELATION' },
        { status: 400 }
      )
    }

    const { data: organizationSettings } = await ctx.supabase
      .from('organization_settings')
      .select('currency')
      .eq('organization_id', ctx.organizationId)
      .maybeSingle()

    let resolvedPricing
    try {
      resolvedPricing = resolveRepairPricingWrite({
        mode: input.pricing_mode,
        currency: organizationSettings?.currency || 'PYG',
        laborCost: input.labor_cost,
        finalCost: input.final_cost,
        discountAmount: input.discount_amount,
        paidAmount: 0,
        parts,
        role: ctx.organizationRole,
        overrideReason: input.price_override_reason,
      })
    } catch (error) {
      if (error instanceof RepairPricingWriteError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      }
      throw error
    }

    // Límite mensual de reparaciones según el plan (free 10/mes, basic 100/mes, pro+ ilimitado).
    const planGate = await canCreateRepair(ctx.organizationId)
    if (!planGate.allowed) {
      const planName = planGate.plan?.name || planGate.plan?.code || 'actual'
      const limitText = planGate.limit === null ? 'ilimitadas' : String(planGate.limit)
      return NextResponse.json(
        {
          error: planGate.blocked
            ? 'No se puede crear la reparacion porque la suscripcion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas reparaciones.'
            : planGate.expired
              ? `No hay cupo para crear esta reparacion. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} reparaciones por mes. Actualiza el plan para crear mas.`
              : `No hay cupo para crear esta reparacion. El plan ${planName} permite ${limitText} reparaciones por mes. Actualiza el plan para crear mas.`,
          code: planGate.blocked ? 'SUBSCRIPTION_BLOCKED' : 'PLAN_LIMIT_REACHED',
          resource: 'repairs',
          current: planGate.current,
          limit: planGate.limit,
        },
        { status: 402 }
      )
    }

    const supabase = ctx.supabase

    const { data: newRepair, error: createError } = await supabase
      .from('repairs')
      .insert({
        ...repairFields,
        estimated_cost: resolvedPricing.estimatedCost,
        labor_cost: resolvedPricing.laborCost,
        final_cost: resolvedPricing.finalCost,
        pricing_mode: resolvedPricing.pricingMode,
        discount_amount: resolvedPricing.discountAmount,
        price_override_reason: resolvedPricing.overrideReason,
        pricing_updated_by: ctx.userId,
        pricing_updated_at: new Date().toISOString(),
        status: 'recibido',
        received_at: new Date().toISOString(),
        organization_id: ctx.organizationId,
        branch_id: ctx.branchId,
      })
      .select('id')
      .single()

    if (createError) {
      logger.error('Repairs API POST insert failed', {
        error: createError.message,
        code: createError.code,
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
      })
      return NextResponse.json({ error: 'No se pudo crear la reparacion.' }, { status: 500 })
    }

    const repairId = newRepair.id

    try {
      if (notes && notes.length > 0) {
        const { error: notesError } = await supabase
          .from('repair_notes')
          .insert(notes.map((n) => ({
            ...n,
            repair_id: repairId,
            author_id: ctx.userId,
            author_name: 'Sistema',
          })))
        if (notesError) throw notesError
      }

      if (Array.isArray(images) && images.length > 0) {
        const imageRows = images
          .filter((url): url is string => typeof url === 'string' && url.length > 0)
          .map((url) => ({
            repair_id: repairId,
            image_url: url,
            image_type: 'general',
          }))

        if (imageRows.length > 0) {
          const { error: imagesError } = await supabase
            .from('repair_images')
            .insert(imageRows)
          if (imagesError) throw imagesError
        }
      }

      // Keep this last: the RPC atomically validates branch stock, consumes
      // inventory, records movements and synchronizes repairs.parts_cost.
      await replaceRepairPartsWithInventory({
        supabase,
        repairId,
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        actorId: ctx.userId,
        parts,
        pricing: {
          laborCost: resolvedPricing.laborCost,
          finalCost: resolvedPricing.finalCost,
          estimatedCost: resolvedPricing.estimatedCost,
          mode: resolvedPricing.pricingMode,
          discountAmount: resolvedPricing.discountAmount,
          overrideReason: resolvedPricing.overrideReason,
          updatedBy: ctx.userId,
        },
      })
    } catch (relatedError) {
      const rollbackResult = await supabase
        .from('repairs')
        .delete()
        .eq('id', repairId)
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)

      const detail = relatedError as SupabaseError
      logger.error('Repairs API POST related rows failed', {
        error: detail?.message || 'unknown',
        code: detail?.code,
        rollbackError: rollbackResult.error?.message,
        repairId,
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
      })
      return NextResponse.json(
        {
          error: relatedError instanceof RepairPartsStockError
            ? relatedError.message
            : 'No se pudieron guardar los detalles de la reparacion.',
          code: relatedError instanceof RepairPartsStockError ? 'REPAIR_STOCK_CHANGED' : 'REPAIR_DETAILS_FAILED',
        },
        { status: relatedError instanceof RepairPartsStockError ? 409 : 500 }
      )
    }

    const { data: fullRepair, error: fetchError } = await supabase
      .from('repairs')
      .select(FULL_REPAIR_SELECT)
      .eq('id', repairId)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .single()

    if (fetchError) {
      logger.error('Repairs API POST fetch failed', {
        error: fetchError.message,
        code: fetchError.code,
        repairId,
      })
      return NextResponse.json({ error: 'La reparacion se creo, pero no se pudo recuperar.' }, { status: 500 })
    }

    return NextResponse.json({ repair: fullRepair }, { status: 201 })
  } catch (error) {
    const detail = error as SupabaseError
    logger.error('Repairs API POST failed', {
      error: detail?.message || (error instanceof Error ? error.message : 'unknown'),
      code: detail?.code,
    })
    return NextResponse.json({ error: 'Error interno al crear la reparacion.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.read')
    if (isNextResponse(ctx)) return ctx

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 50)))
    const status = searchParams.get('status') || null
    const search = (searchParams.get('search') || '').trim()
    const offset = (page - 1) * pageSize

    let lastError: unknown = null

    for (const selectExpr of REPAIR_SELECT_VARIANTS) {
      let query = ctx.supabase
        .from('repairs')
        .select(selectExpr, { count: 'exact' })
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(`device_brand.ilike.%${search}%,device_model.ilike.%${search}%,problem_description.ilike.%${search}%,ticket_number.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (!error) {
        return NextResponse.json({
          repairs: data ?? [],
          pagination: {
            page,
            pageSize,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize),
          },
        })
      }

      lastError = error
      const message = String(error.message || '').toLowerCase()
      const isSchemaError = message.includes('column') || message.includes('does not exist')
      if (!isSchemaError) break
    }

    // Los errores de Supabase son objetos planos, no instancias de Error, asi
    // que `instanceof Error` era siempre falso y la causa real se perdia detras
    // de un mensaje generico. Se extrae el detalle y ademas se registra.
    const supabaseError = lastError as { message?: string; code?: string; details?: string; hint?: string } | null
    const detail = supabaseError?.message || (lastError instanceof Error ? lastError.message : '')

    logger.error('Repairs API GET failed', {
      error: detail || 'unknown',
      code: supabaseError?.code,
      details: supabaseError?.details,
      hint: supabaseError?.hint,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
    })

    return NextResponse.json(
      { error: detail || 'No se pudieron cargar las reparaciones', code: supabaseError?.code },
      { status: 500 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
