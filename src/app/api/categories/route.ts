import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

const categoryUpdateSchema = categorySchema.partial().extend({
  id: z.string().uuid(),
})

export const GET = withTenantAuth({ permission: 'inventory.products.read', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search')?.trim()
    const supabase = await createClient()

    let query = supabase
      .from('categories')
      .select('id,name,description,parent_id,is_active,created_at,updated_at')
      .eq('organization_id', organization.id)

    if (isActive === 'true' || isActive === 'false') {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    logger.error('Categories API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar las categorias.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'inventory.products.create', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = categorySchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
    }

    const payload = validation.data
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
      .insert({
        id: payload.id,
        organization_id: organization.id,
        name: payload.name,
        description: payload.description ?? '',
        parent_id: payload.parent_id ?? null,
        is_active: payload.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('Categories API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear la categoria.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'inventory.products.update', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = categoryUpdateSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
    }

    const { id, ...updates } = validation.data
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
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
    logger.error('Categories API PUT error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar la categoria.' }, { status: 500 })
  }
})

export const DELETE = withTenantAuth({ permission: 'inventory.products.delete', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Categories API DELETE error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo eliminar la categoria.' }, { status: 500 })
  }
})
