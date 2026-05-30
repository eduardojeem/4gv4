import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(200),
  contact_name: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  tax_id: z.string().trim().max(80).optional().nullable(),
  status: z.string().trim().max(40).optional().nullable(),
  business_type: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  postal_code: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(240).optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
})

const supplierUpdateSchema = supplierSchema.partial().extend({
  id: z.string().uuid(),
})

function normalizePayload(payload: Partial<z.infer<typeof supplierSchema>>) {
  const normalized: Record<string, unknown> = {
    ...payload,
    updated_at: new Date().toISOString(),
  }

  if ('email' in payload) normalized.email = payload.email || null
  if ('status' in payload || 'is_active' in payload) {
    normalized.status = payload.status || (payload.is_active === false ? 'inactive' : 'active')
    normalized.is_active = payload.is_active ?? normalized.status !== 'inactive'
  }

  return normalized
}

export const GET = withTenantAuth({ permission: 'inventory.products.read', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const status = searchParams.get('status')
    const businessType = searchParams.get('business_type')
    const isActive = searchParams.get('is_active')
    const page = Math.max(0, Number(searchParams.get('page') || 0))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || searchParams.get('limit') || 50)))
    const from = page * pageSize
    const to = from + pageSize - 1
    const supabase = await createClient()

    let query = supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization.id)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,contact_name.ilike.%${search}%`)
    }
    if (status && status !== 'all') query = query.eq('status', status)
    if (businessType && businessType !== 'all') query = query.eq('business_type', businessType)
    if (isActive === 'true' || isActive === 'false') query = query.eq('is_active', isActive === 'true')

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const rows = data ?? []
    const stats = {
      total_suppliers: count ?? rows.length,
      active_suppliers: rows.filter((supplier) => supplier.status === 'active' || supplier.is_active === true).length,
      inactive_suppliers: rows.filter((supplier) => supplier.status === 'inactive' || supplier.is_active === false).length,
      pending_suppliers: rows.filter((supplier) => supplier.status === 'pending').length,
      avg_rating: rows.length ? rows.reduce((sum, supplier) => sum + Number(supplier.rating || 0), 0) / rows.length : 0,
      total_orders: 0,
      total_amount: 0,
    }

    return NextResponse.json({ success: true, data: rows, count: count ?? 0, stats })
  } catch (error) {
    logger.error('Suppliers API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los proveedores.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'inventory.products.create', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = supplierSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const payload = {
      ...normalizePayload(validation.data),
      status: validation.data.status || (validation.data.is_active === false ? 'inactive' : 'active'),
      is_active: validation.data.is_active ?? validation.data.status !== 'inactive',
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ ...payload, organization_id: organization.id, created_at: new Date().toISOString() })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('Suppliers API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el proveedor.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'inventory.products.update', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = supplierUpdateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const { id, ...updates } = validation.data
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('suppliers')
      .update(normalizePayload(updates))
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Suppliers API PUT error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el proveedor.' }, { status: 500 })
  }
})

export const DELETE = withTenantAuth({ permission: 'inventory.products.delete', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const ids = (searchParams.get('ids') || searchParams.get('id') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .in('id', ids)
      .eq('organization_id', organization.id)

    if (error) throw error
    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error) {
    logger.error('Suppliers API DELETE error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el proveedor.' }, { status: 500 })
  }
})
