import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { loadCatalogForOrganization } from '@/lib/categories/global-catalog.server'
import { planGlobalImport, type LocalCategory } from '@/lib/categories/global-import'

export const dynamic = 'force-dynamic'

/**
 * El catálogo global para que la tienda agregue categorías ya vinculadas.
 *
 * GET devuelve las categorías globales del rubro de la empresa (y las que no
 * tienen rubro). POST crea en la tienda las elegidas, con sus padres, y vincula
 * las que ya existían con el mismo nombre.
 */

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { organization }) => {
  try {
    const { vertical, catalog } = await loadCatalogForOrganization(organization.id)
    return NextResponse.json({ success: true, vertical, data: catalog })
  } catch (error) {
    logger.error('No se pudo cargar el catálogo global de categorías', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el catálogo de categorías.' }, { status: 500 })
  }
})

const importSchema = z.object({
  globalCategoryIds: z.array(z.string().uuid()).min(1, 'Elegí al menos una categoría.').max(200),
})

export const POST = withTenantAuth({ permission: 'products.create', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = importSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Datos inválidos.' }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const [{ catalog }, { data: localRows, error: localError }] = await Promise.all([
      loadCatalogForOrganization(organization.id),
      admin.from('categories').select('id, name, parent_id, global_category_id').eq('organization_id', organization.id),
    ])
    if (localError) throw localError

    // Solo se puede elegir del catálogo del rubro: un id de otro rubro se ignora.
    const allowed = new Set(catalog.map((category) => category.id))
    const selected = validation.data.globalCategoryIds.filter((id) => allowed.has(id))
    if (selected.length === 0) {
      return NextResponse.json({ success: false, error: 'Esas categorías no están en el catálogo de tu rubro.' }, { status: 400 })
    }

    const plan = planGlobalImport(selected, catalog, (localRows ?? []) as LocalCategory[])
    const localByGlobal = new Map<string, string>()
    let created = 0
    let linked = 0
    const now = new Date().toISOString()

    // En orden, padres primero: cada una se crea cuando su padre ya tiene id.
    for (const step of plan) {
      if (step.kind === 'present') {
        localByGlobal.set(step.globalId, step.localId)
        continue
      }
      if (step.kind === 'link') {
        const { error } = await admin
          .from('categories')
          .update({ global_category_id: step.globalId, updated_at: now })
          .eq('id', step.localId)
          .eq('organization_id', organization.id)
          .is('global_category_id', null)
        if (error) throw error
        localByGlobal.set(step.globalId, step.localId)
        linked += 1
        continue
      }
      const { data, error } = await admin
        .from('categories')
        .insert({
          organization_id: organization.id,
          name: step.name,
          description: '',
          parent_id: step.parentGlobalId ? localByGlobal.get(step.parentGlobalId) ?? null : null,
          global_category_id: step.globalId,
          is_active: true,
          updated_at: now,
        })
        .select('id')
        .single()
      if (error) throw error
      localByGlobal.set(step.globalId, data.id)
      created += 1
    }

    return NextResponse.json({ success: true, created, linked, alreadyPresent: plan.filter((step) => step.kind === 'present').length })
  } catch (error) {
    logger.error('No se pudieron agregar las categorías del catálogo', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron agregar las categorías del catálogo.' }, { status: 500 })
  }
})
