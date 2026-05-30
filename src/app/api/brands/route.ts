import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const brandSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  website: z.string().trim().max(240).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  founded_year: z.number().int().min(1800).max(2200).optional().nullable(),
  logo_url: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
})

const brandUpdateSchema = brandSchema.partial().extend({
  id: z.string().uuid(),
})

export const GET = withTenantAuth({ permission: 'inventory.products.read', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const isActive = searchParams.get('is_active')
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
    const from = (page - 1) * limit
    const to = from + limit - 1
    const supabase = await createClient()

    let query = supabase
      .from('brands')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization.id)

    if (isActive === 'true' || isActive === 'false') {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, to)

    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [], count: count ?? 0 })
  } catch (error) {
    logger.error('Brands API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar las marcas.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'inventory.products.create', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = brandSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const payload = validation.data
    const supabase = await createClient()
    const { data: existing, error: existingError } = await supabase
      .from('brands')
      .select('id')
      .eq('organization_id', organization.id)
      .ilike('name', payload.name)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) {
      return NextResponse.json({ success: false, error: 'Ya existe una marca con este nombre.' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('brands')
      .insert({
        ...payload,
        organization_id: organization.id,
        is_active: payload.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('Brands API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear la marca.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'inventory.products.update', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = brandUpdateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const { id, ...updates } = validation.data
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('brands')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Brands API PUT error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar la marca.' }, { status: 500 })
  }
})

export const DELETE = withTenantAuth({ permission: 'inventory.products.delete', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Brand ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { count, error: productError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('brand_id', id)

    if (productError) throw productError
    if ((count ?? 0) > 0) {
      return NextResponse.json({ success: false, error: `No se puede eliminar: esta marca tiene ${count} productos asociados.` }, { status: 409 })
    }

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Brands API DELETE error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo eliminar la marca.' }, { status: 500 })
  }
})
