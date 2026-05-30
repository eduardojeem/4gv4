import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  ruc: z.string().trim().max(50).optional().nullable(),
  segment: z.string().trim().max(50).optional().nullable(),
  customer_type: z.string().trim().max(50).optional().nullable(),
  credit_limit: z.number().optional().nullable(),
  discount_percentage: z.number().optional().nullable(),
  payment_terms: z.string().trim().max(120).optional().nullable(),
  preferred_contact: z.string().trim().max(50).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  whatsapp: z.string().trim().max(50).optional().nullable(),
  social_media: z.string().trim().max(200).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  position: z.string().trim().max(120).optional().nullable(),
  referral_source: z.string().trim().max(120).optional().nullable(),
  assigned_salesperson: z.string().trim().max(120).optional().nullable(),
  birthday: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

const customerUpdateSchema = customerSchema.partial().extend({
  id: z.string().uuid(),
})

function normalizeCustomerPayload(payload: z.infer<typeof customerSchema>) {
  return {
    ...payload,
    email: payload.email || null,
    phone: payload.phone || '',
    status: payload.status ?? 'active',
    updated_at: new Date().toISOString(),
  }
}

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))
    const search = searchParams.get('search')?.trim()
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

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%`)
    }

    if (status && status !== 'all') query = query.eq('status', status)
    if (customerType && customerType !== 'all') query = query.eq('customer_type', customerType)
    if (segment && segment !== 'all') query = query.eq('segment', segment)
    if (city && city !== 'all') query = query.eq('city', city)

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data ?? [],
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

export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }) => {
  try {
    const validation = customerSchema.safeParse(await request.json())

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
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('Customers API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el cliente.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }) => {
  try {
    const validation = customerUpdateSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const { id, ...updates } = validation.data
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
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

    const supabase = await createClient()
    const { error } = await supabase
      .from('customers')
      .delete()
      .in('id', ids)
      .eq('organization_id', organization.id)

    if (error) throw error

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error) {
    logger.error('Customers API DELETE error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el cliente.' }, { status: 500 })
  }
})
