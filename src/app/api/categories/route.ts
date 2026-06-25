import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  global_category_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

const categoryUpdateSchema = categorySchema.partial().extend({
  id: z.string().uuid(),
})

type CategoryRow = {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  global_category_id?: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

function matchesSearch(category: CategoryRow, search?: string) {
  if (!search) return true
  const term = search.toLowerCase()
  return category.name.toLowerCase().includes(term) || (category.description ?? '').toLowerCase().includes(term)
}

async function assertParentIsValid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  parentId: string | null | undefined,
  categoryId?: string
) {
  if (!parentId) return null

  if (parentId === categoryId) {
    return 'Una categoria no puede ser padre de si misma.'
  }

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id,parent_id')
    .eq('organization_id', organizationId)

  if (error) throw error

  const categoryMap = new Map((categories ?? []).map((category) => [category.id, category.parent_id]))

  if (!categoryMap.has(parentId)) {
    return 'La categoria padre no existe en esta organizacion.'
  }

  if (categoryId) {
    let currentParent = categoryMap.get(parentId)
    while (currentParent) {
      if (currentParent === categoryId) {
        return 'No se puede crear una jerarquia circular de categorias.'
      }
      currentParent = categoryMap.get(currentParent) ?? null
    }
  }

  return null
}

async function assertGlobalCategoryIsValid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  globalCategoryId: string | null | undefined
) {
  if (!globalCategoryId) return null

  const { data, error } = await supabase
    .from('global_categories')
    .select('id')
    .eq('id', globalCategoryId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data ? null : 'La categoria global seleccionada no esta disponible.'
}

async function assertUniqueName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  name: string,
  categoryId?: string
) {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data && data.id !== categoryId) {
    return 'Ya existe una categoria con este nombre.'
  }
  return null
}

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search')?.trim()
    const supabase = await createClient()

    const { data: categoryRows, error } = await supabase
      .from('categories')
      .select('id,name,description,parent_id,global_category_id,is_active,created_at,updated_at')
      .eq('organization_id', organization.id)

    if (error) throw error

    const activeFiltered = (categoryRows ?? [])
      .filter((category) => isActive !== 'true' && isActive !== 'false' ? true : category.is_active === (isActive === 'true'))
      .filter((category) => matchesSearch(category as CategoryRow, search))
      .sort((a, b) => a.name.localeCompare(b.name))

    const categoryIds = activeFiltered.map((category) => category.id)
    const productCounts = new Map<string, number>()

    if (categoryIds.length > 0) {
      const { data: productRows, error: productsError } = await supabase
        .from('products')
        .select('category_id')
        .eq('organization_id', organization.id)
        .in('category_id', categoryIds)

      if (productsError) throw productsError

      for (const product of productRows ?? []) {
        if (!product.category_id) continue
        productCounts.set(product.category_id, (productCounts.get(product.category_id) ?? 0) + 1)
      }
    }

    return NextResponse.json({
      success: true,
      data: activeFiltered.map((category) => ({
        ...category,
        products_count: productCounts.get(category.id) ?? 0,
      })),
      permissions: {
        canCreate: roleHasPermission(organization.role as OrganizationRole, 'products.create'),
        canUpdate: roleHasPermission(organization.role as OrganizationRole, 'products.update'),
        canDelete: roleHasPermission(organization.role as OrganizationRole, 'products.delete'),
      },
    })
  } catch (error) {
    logger.error('Categories API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar las categorias.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'products.create', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = categorySchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
    }

    const payload = validation.data
    const supabase = await createClient()
    const [parentError, globalCategoryError, uniqueNameError] = await Promise.all([
      assertParentIsValid(supabase, organization.id, payload.parent_id),
      assertGlobalCategoryIsValid(supabase, payload.global_category_id),
      assertUniqueName(supabase, organization.id, payload.name),
    ])

    const validationError = parentError || globalCategoryError || uniqueNameError
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        id: payload.id,
        organization_id: organization.id,
        name: payload.name,
        description: payload.description ?? '',
        parent_id: payload.parent_id ?? null,
        global_category_id: payload.global_category_id ?? null,
        is_active: payload.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      console.error('[CATEGORIES POST] Insert error:', error.message, error.code, error.details, error.hint)
      throw error
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error)
    const errCode = (error as any)?.code || ''
    const errDetails = (error as any)?.details || (error as any)?.hint || ''
    console.error('[CATEGORIES POST] Failed:', errMsg, errCode, errDetails)
    logger.error('Categories API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear la categoria.', _debug: `${errMsg} | code: ${errCode} | ${errDetails}` }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = categoryUpdateSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
    }

    const { id, ...updates } = validation.data
    const supabase = await createClient()
    const [parentError, globalCategoryError, uniqueNameError] = await Promise.all([
      updates.parent_id !== undefined ? assertParentIsValid(supabase, organization.id, updates.parent_id, id) : Promise.resolve(null),
      updates.global_category_id !== undefined ? assertGlobalCategoryIsValid(supabase, updates.global_category_id) : Promise.resolve(null),
      updates.name ? assertUniqueName(supabase, organization.id, updates.name, id) : Promise.resolve(null),
    ])

    const validationError = parentError || globalCategoryError || uniqueNameError
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 409 })
    }

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

export const DELETE = withTenantAuth({ permission: 'products.delete', module: 'inventory' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const [{ count: childCount, error: childError }, { count: productCount, error: productError }] = await Promise.all([
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('parent_id', id),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('category_id', id),
    ])

    if (childError) throw childError
    if (productError) throw productError

    if ((childCount ?? 0) > 0) {
      return NextResponse.json({ success: false, error: 'No se puede eliminar: esta categoria tiene subcategorias.' }, { status: 409 })
    }

    if ((productCount ?? 0) > 0) {
      return NextResponse.json({ success: false, error: 'No se puede eliminar: esta categoria tiene productos asociados.' }, { status: 409 })
    }

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
