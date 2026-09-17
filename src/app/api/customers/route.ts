import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sanitizeSearchTerm } from '@/lib/api/sanitize-search'
import { duplicatesMessage, findCustomerDuplicates } from '@/lib/customers/duplicate-check'
import {
  buildCustomerIdentity,
  normalizeCustomerStatus,
  normalizeCustomerType,
  statusForDatabase,
} from '@/lib/customers/customer-contract'

const customerSchema = z.object({
  name: z.string({ message: 'Ingresá el nombre del cliente.' }).trim().min(1, 'Ingresá el nombre del cliente.').max(200, 'El nombre admite hasta 200 caracteres.'),
  first_name: z.string().trim().max(120).optional().nullable(),
  last_name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email('El correo no es válido.').optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  // Contacto de un tercero: el celular del cliente suele ser el equipo que dejo
  // en el taller, asi que ahi no se lo puede ubicar.
  alternate_phone: z.string().trim().max(50).optional().nullable(),
  alternate_phone_label: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  ruc: z.string().trim().max(50).optional().nullable(),
  segment: z.string().trim().max(50).optional().nullable(),
  customer_type: z.string().trim().max(50).optional().nullable(),
  // Los mismos rangos que valida el formulario. La API aceptaba cualquier número:
  // desde una edición masiva o una llamada directa se podía guardar un límite de
  // crédito negativo o un descuento del 500%.
  credit_limit: z.number({ message: 'El límite de crédito debe ser un número.' })
    .finite()
    .min(0, 'El límite de crédito no puede ser negativo.')
    .max(1_000_000_000_000, 'El límite de crédito es demasiado alto.')
    .optional()
    .nullable(),
  discount_percentage: z.number({ message: 'El descuento debe ser un número.' })
    .finite()
    .min(0, 'El descuento no puede ser negativo.')
    .max(100, 'El descuento no puede superar el 100%.')
    .optional()
    .nullable(),
  payment_terms: z.string().trim().max(120).optional().nullable(),
  preferred_contact: z.string().trim().max(50).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  whatsapp: z.string().trim().max(50).optional().nullable(),
  social_media: z.string().trim().max(200).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  company_name: z.string().trim().max(200).optional().nullable(),
  position: z.string().trim().max(120).optional().nullable(),
  referral_source: z.string().trim().max(120).optional().nullable(),
  assigned_salesperson: z.string().trim().max(120).optional().nullable(),
  birthday: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending', 'activo', 'inactivo', 'suspendido', 'pendiente']).optional(),
})

const customerUpdateSchema = customerSchema.partial().extend({
  id: z.string().uuid(),
})

function normalizeCustomerPayload(payload: z.infer<typeof customerSchema>) {
  return {
    ...payload,
    ...buildCustomerIdentity(payload),
    email: payload.email || null,
    phone: payload.phone || '',
    customer_type: normalizeCustomerType(payload.customer_type),
    status: statusForDatabase(payload.status ?? 'active'),
    updated_at: new Date().toISOString(),
  }
}

function normalizeCustomerResponse<T extends Record<string, unknown>>(customer: T) {
  return {
    ...customer,
    ...buildCustomerIdentity(customer),
    customer_type: normalizeCustomerType(customer.customer_type),
    status: normalizeCustomerStatus(customer.status),
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CustomerBlocker = {
  id: string
  name: string
  sales: number
  credits: number
  repairs: number
  storeCreditMovements: number
  afterSales: number
}

function describeBlockers(blocked: CustomerBlocker) {
  const parts: string[] = []
  if (blocked.sales > 0) parts.push(`${blocked.sales} venta(s)/factura(s)`)
  if (blocked.credits > 0) parts.push(`${blocked.credits} crédito(s) y cuotas`)
  if (blocked.repairs > 0) parts.push(`${blocked.repairs} reparación(es)`)
  if (blocked.storeCreditMovements > 0) parts.push(`${blocked.storeCreditMovements} saldo/movimiento(s)`)
  if (blocked.afterSales > 0) parts.push(`${blocked.afterSales} caso(s) de posventa`)
  return parts.join(', ')
}

/**
 * Devuelve los clientes que tienen historial relacionado a la organización que se perdería
 * (o que infringe la integridad contable). Bloquea la eliminación si existen ventas,
 * reparaciones, créditos, movimientos de saldo o garantías.
 */
async function findCustomersWithHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  ids: string[]
): Promise<CustomerBlocker[]> {
  const { data: rows, error: customersError } = await supabase
    .from('customers')
    .select('id, name')
    .in('id', ids)
    .eq('organization_id', organizationId)

  if (customersError) throw customersError

  const names = new Map((rows ?? []).map((row) => [String(row.id), String(row.name ?? 'Cliente')]))
  if (names.size === 0) return []

  const [salesResult, creditsResult, repairsResult, storeCreditResult, afterSalesResult] = await Promise.all([
    supabase.from('sales').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId),
    supabase.from('customer_credits').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId),
    supabase.from('repairs').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId),
    // `customer_store_credit_movements` no existe: la tabla es `customer_store_credits`.
    supabase.from('customer_store_credits').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId),
    supabase.from('after_sales_cases').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId),
  ])

  const countBy = (rows: Array<{ customer_id?: unknown }> | null) => {
    const map = new Map<string, number>()
    for (const row of rows ?? []) {
      const key = String(row.customer_id ?? '')
      if (key) map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }

  const historyResults = [salesResult, creditsResult, repairsResult, storeCreditResult, afterSalesResult]
  const historyError = historyResults.find((result) => result.error)?.error
  if (historyError) throw historyError

  const salesByCustomer = countBy(salesResult.data)
  const creditsByCustomer = countBy(creditsResult.data)
  const repairsByCustomer = countBy(repairsResult.data)
  const storeCreditByCustomer = countBy(storeCreditResult.data)
  const afterSalesByCustomer = countBy(afterSalesResult.data)

  const blocked: CustomerBlocker[] = []
  for (const [id, name] of names) {
    const sales = salesByCustomer.get(id) ?? 0
    const credits = creditsByCustomer.get(id) ?? 0
    const repairs = repairsByCustomer.get(id) ?? 0
    const storeCreditMovements = storeCreditByCustomer.get(id) ?? 0
    const afterSales = afterSalesByCustomer.get(id) ?? 0

    if (sales > 0 || credits > 0 || repairs > 0 || storeCreditMovements > 0 || afterSales > 0) {
      blocked.push({ id, name, sales, credits, repairs, storeCreditMovements, afterSales })
    }
  }

  return blocked
}

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))
    // Sanitizado: se interpola en un filtro `.or(...)` de PostgREST.
    const search = sanitizeSearchTerm(searchParams.get('search'))
    // Busqueda directa por id: el `search` de texto no consulta la columna id,
    // asi que resolver un cliente por UUID requiere su propio parametro.
    const idParam = searchParams.get('id')?.trim()
    const status = searchParams.get('status')
    const customerType = searchParams.get('customer_type')
    const segment = searchParams.get('segment')
    const city = searchParams.get('city')
    const from = (page - 1) * limit
    const to = from + limit - 1
    const supabase = await createClient()

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization.id)

    if (idParam) query = query.eq('id', idParam)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%,ruc.ilike.%${search}%`)
    }

    if (status && status !== 'all') query = query.eq('status', statusForDatabase(status))
    if (customerType && customerType !== 'all') query = query.eq('customer_type', customerType)
    if (segment && segment !== 'all') query = query.eq('segment', segment)
    if (city && city !== 'all') query = query.eq('city', city)

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(normalizeCustomerResponse),
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    })
  } catch (error) {
    logger.error('Customers API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los clientes.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: ['crm.customers.manage', 'pos.sales.create'], module: 'crm' }, async (request, { organization }) => {
  try {
    const validation = customerSchema.safeParse(await request.json())

    if (!validation.success) {
      // El primer problema, dicho en castellano: «Error de validación» a secas
      // no le decía a nadie qué campo corregir.
      return NextResponse.json({
        success: false,
        error: validation.error.issues[0]?.message || 'Revisá los datos del cliente.',
        field: validation.error.issues[0]?.path.join('.'),
        details: validation.error.issues,
      }, { status: 400 })
    }

    const supabase = await createClient()

    // Telefono, correo y RUC no se pueden repetir dentro de la misma empresa:
    // el mismo cliente cargado dos veces reparte su deuda, sus compras y sus
    // reparaciones entre fichas distintas.
    const duplicates = await findCustomerDuplicates(supabase, organization.id, {
      phone: validation.data.phone,
      email: validation.data.email,
      ruc: validation.data.ruc,
    })

    if (duplicates.length > 0) {
      return NextResponse.json(
        { success: false, code: 'CUSTOMER_DUPLICATE', error: duplicatesMessage(duplicates), duplicates },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...normalizeCustomerPayload(validation.data),
        organization_id: organization.id,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: normalizeCustomerResponse(data) }, { status: 201 })
  } catch (error) {
    logger.error('Customers API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el cliente.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }) => {
  try {
    const validation = customerUpdateSchema.safeParse(await request.json())

    if (!validation.success) {
      // El primer problema, dicho en castellano: «Error de validación» a secas
      // no le decía a nadie qué campo corregir.
      return NextResponse.json({
        success: false,
        error: validation.error.issues[0]?.message || 'Revisá los datos del cliente.',
        field: validation.error.issues[0]?.path.join('.'),
        details: validation.error.issues,
      }, { status: 400 })
    }

    const { id, ...updates } = validation.data
    const supabase = await createClient()

    const { data: current, error: currentError } = await supabase
      .from('customers')
      .select('name, first_name, last_name, company, company_name, customer_type, status')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()

    if (currentError) throw currentError

    const normalizedUpdates = {
      ...updates,
      ...buildCustomerIdentity({ ...current, ...updates }),
      ...(updates.customer_type !== undefined
        ? { customer_type: normalizeCustomerType(updates.customer_type) }
        : {}),
      ...(updates.status !== undefined ? { status: statusForDatabase(updates.status) } : {}),
      updated_at: new Date().toISOString(),
    }

    // Telefono, correo y RUC no se pueden repetir dentro de la misma empresa:
    // el mismo cliente cargado dos veces reparte su deuda, sus compras y sus
    // reparaciones entre fichas distintas.
    const duplicates = await findCustomerDuplicates(supabase, organization.id, {
      phone: validation.data.phone,
      email: validation.data.email,
      ruc: validation.data.ruc,
      excludeId: id,
    })

    if (duplicates.length > 0) {
      return NextResponse.json(
        { success: false, code: 'CUSTOMER_DUPLICATE', error: duplicatesMessage(duplicates), duplicates },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('customers')
      .update({
        ...normalizedUpdates,
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: normalizeCustomerResponse(data) })
  } catch (error) {
    logger.error('Customers API PUT error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el cliente.' }, { status: 500 })
  }
})

export const DELETE = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const ids = (searchParams.get('ids') || searchParams.get('id') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Customer ID is required' }, { status: 400 })
    }

    const invalidIds = ids.filter((id) => !UUID_RE.test(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ success: false, error: 'Hay identificadores de cliente invalidos.' }, { status: 400 })
    }

    const supabase = await createClient()

    // Borrar un cliente arrastra en cascada sus creditos, cuotas y PAGOS
    // registrados, y las reparaciones lo bloquean por ON DELETE RESTRICT.
    // Antes de borrar se revisa que no haya historial que perder.
    const blocked = await findCustomersWithHistory(supabase, organization.id, ids)

    if (blocked.length > 0) {
      return NextResponse.json({
        success: false,
        error: blocked.length === 1
          ? `No se puede eliminar a ${blocked[0].name}: ${describeBlockers(blocked[0])}. Desactivalo en lugar de eliminarlo para conservar su historial.`
          : `No se pueden eliminar ${blocked.length} clientes porque tienen historial asociado. Desactivalos en lugar de eliminarlos.`,
        code: 'CUSTOMER_HAS_HISTORY',
        blocked,
      }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('customers')
      .delete()
      .in('id', ids)
      .eq('organization_id', organization.id)
      .select('id')

    if (error) throw error

    // Se informa lo realmente borrado: un id de otra organizacion se filtra por
    // organization_id y no debe contarse como eliminado.
    return NextResponse.json({ success: true, deleted: (data ?? []).length })
  } catch (error) {
    logger.error('Customers API DELETE error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el cliente.' }, { status: 500 })
  }
})
