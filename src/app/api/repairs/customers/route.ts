import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { sanitizeSearchTerm } from '@/lib/api/sanitize-search'
import { logger } from '@/lib/logger'
import { getCustomerWriteErrorResponse } from './customer-api-errors'

const repairCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  ruc: z.string().trim().max(50).optional().nullable(),
  customer_type: z.string().trim().max(50).optional().nullable(),
  is_wholesale: z.boolean().optional(),
  // Contacto de un tercero: el celular del cliente suele ser el equipo que dejo
  // en el taller, asi que ahi no se lo puede ubicar. Sin estos campos en el
  // esquema, Zod los descartaba en silencio y el dato nunca llegaba al insert.
  alternate_phone: z.string().trim().max(50).optional().nullable(),
  alternate_phone_label: z.string().trim().max(60).optional().nullable(),
})

const repairCustomerUpdateSchema = repairCustomerSchema.partial().extend({
  id: z.string().uuid(),
})

function normalizeCustomerPayload(payload: z.infer<typeof repairCustomerSchema>) {
  const isWholesale = Boolean(payload.is_wholesale || payload.customer_type === 'wholesale' || payload.customer_type === 'mayorista')
  const customerType = isWholesale ? 'wholesale' : (payload.customer_type || 'regular')
  const { is_wholesale, alternate_phone, alternate_phone_label, ...rest } = payload
  // Las columnas del contacto alternativo solo se mandan si hay algo que
  // guardar. Asi un despliegue sin la migracion sigue creando clientes como
  // siempre, y solo falla -con motivo- si alguien intenta usar el campo nuevo.
  const alternateContact = alternate_phone
    ? {
        alternate_phone,
        // Sin telefono la aclaracion de quien atiende no significa nada.
        alternate_phone_label: alternate_phone_label || null,
      }
    : {}
  return {
    ...rest,
    ...alternateContact,
    email: payload.email || null,
    phone: payload.phone || '',
    address: payload.address || null,
    city: payload.city || null,
    ruc: payload.ruc || null,
    customer_type: customerType,
    segment: isWholesale ? 'wholesale' : 'regular',
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  }
}

function normalizeCustomerUpdatePayload(payload: z.infer<typeof repairCustomerUpdateSchema>) {
  const { id, is_wholesale, alternate_phone, alternate_phone_label, ...rest } = payload
  const isWholesale = is_wholesale !== undefined
    ? is_wholesale
    : payload.customer_type !== undefined
      ? Boolean(payload.customer_type === 'wholesale' || payload.customer_type === 'mayorista')
      : undefined

  const customerType = isWholesale !== undefined
    ? (isWholesale ? 'wholesale' : 'regular')
    : payload.customer_type

  const alternateContact: Record<string, string | null> = {}
  if (alternate_phone !== undefined) {
    alternateContact.alternate_phone = alternate_phone || null
    if (alternate_phone_label !== undefined) {
      alternateContact.alternate_phone_label = alternate_phone ? (alternate_phone_label || null) : null
    }
  }

  const updates: Record<string, unknown> = {
    ...rest,
    ...alternateContact,
    updated_at: new Date().toISOString(),
  }

  if (customerType !== undefined) {
    updates.customer_type = customerType
  }
  if (isWholesale !== undefined) {
    updates.segment = isWholesale ? 'wholesale' : 'regular'
  }
  if (payload.email !== undefined) {
    updates.email = payload.email || null
  }
  if (payload.phone !== undefined) {
    updates.phone = payload.phone || ''
  }
  if (payload.address !== undefined) {
    updates.address = payload.address || null
  }
  if (payload.city !== undefined) {
    updates.city = payload.city || null
  }
  if (payload.ruc !== undefined) {
    updates.ruc = payload.ruc || null
  }

  return { id, updates }
}

const readPermissions = ['repairs.orders.read', 'crm.customers.read'] as const
const writePermissions = ['repairs.orders.create', 'repairs.orders.update', 'crm.customers.manage'] as const

export const GET = withTenantAuth({ permission: [...readPermissions], module: 'repairs' }, async (request, { organization }) => {
  try {
    // Sin `q`, esto traía los 200 clientes más recientes y el selector
    // filtraba esa lista fija en el navegador: un cliente que no estuviera
    // entre esos 200 era imposible de encontrar sin importar qué se
    // escribiera, porque nunca llegaba a pedirse. Con `q`, la búsqueda es
    // server-side y alcanza a cualquier cliente de la organización.
    const { searchParams } = new URL(request.url)
    const term = sanitizeSearchTerm(searchParams.get('q'))

    const supabase = await createClient()
    let query = supabase
      .from('customers')
      .select('id, customer_code, name, email, phone, alternate_phone, alternate_phone_label, address, city, ruc, customer_type, status, created_at, updated_at')
      .eq('organization_id', organization.id)

    if (term) {
      const digits = term.replace(/\D/g, '')
      const orFilters = [
        `name.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `customer_code.ilike.%${term}%`,
        `ruc.ilike.%${term}%`,
      ]
      // Buscar por teléfono solo si el término tiene dígitos: de lo
      // contrario `phone.ilike.%%` matchea todo y arruina el resto del filtro.
      if (digits) orFilters.push(`phone.ilike.%${digits}%`)
      query = query.or(orFilters.join(','))
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(term ? 50 : 20)

    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    logger.error('Repair customers API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los clientes.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: [...writePermissions], module: 'repairs' }, async (request, { organization }) => {
  try {
    const validation = repairCustomerSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...normalizeCustomerPayload(validation.data),
        organization_id: organization.id,
        created_at: now,
        updated_at: now,
      })
      .select('id, customer_code, name, email, phone, alternate_phone, alternate_phone_label, address, city, ruc, customer_type, status, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('Repair customers API POST error', { error })
    const response = getCustomerWriteErrorResponse(error as { code?: string; message?: string })
    return NextResponse.json(response.body, { status: response.status })
  }
})

export const PUT = withTenantAuth({ permission: [...writePermissions], module: 'repairs' }, async (request, { organization }) => {
  try {
    const validation = repairCustomerUpdateSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const { id, updates } = normalizeCustomerUpdatePayload(validation.data)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('id, customer_code, name, email, phone, alternate_phone, alternate_phone_label, address, city, ruc, customer_type, status, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Repair customers API PUT error', { error })
    const response = getCustomerWriteErrorResponse(error as { code?: string; message?: string }, 'update')
    return NextResponse.json(response.body, { status: response.status })
  }
})
