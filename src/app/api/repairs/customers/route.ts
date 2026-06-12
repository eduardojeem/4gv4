import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const repairCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  ruc: z.string().trim().max(50).optional().nullable(),
})

const repairCustomerUpdateSchema = repairCustomerSchema.partial().extend({
  id: z.string().uuid(),
})

function normalizeCustomerPayload(payload: z.infer<typeof repairCustomerSchema>) {
  return {
    ...payload,
    email: payload.email || null,
    phone: payload.phone || '',
    address: payload.address || null,
    city: payload.city || null,
    ruc: payload.ruc || null,
    customer_type: 'regular',
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  }
}

const readPermissions = ['repairs.orders.read', 'crm.customers.read'] as const
const writePermissions = ['repairs.orders.create', 'repairs.orders.update', 'crm.customers.manage'] as const

export const GET = withTenantAuth({ permission: [...readPermissions], module: 'repairs' }, async (_request, { organization }) => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customers')
      .select('id, customer_code, name, email, phone, address, city, ruc, customer_type, status, created_at, updated_at')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(200)

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
      .select('id, customer_code, name, email, phone, address, city, ruc, customer_type, status, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('Repair customers API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el cliente.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: [...writePermissions], module: 'repairs' }, async (request, { organization }) => {
  try {
    const validation = repairCustomerUpdateSchema.safeParse(await request.json())

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
      .select('id, customer_code, name, email, phone, address, city, ruc, customer_type, status, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Repair customers API PUT error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el cliente.' }, { status: 500 })
  }
})
