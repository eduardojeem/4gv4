import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { buildCountItems } from '@/lib/inventory/inventory-count-server'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'

export const dynamic = 'force-dynamic'

const MISSING_TABLE = /does not exist|could not find|schema cache/i
const COUNT_COLUMNS = 'id, number, name, status, branch_id, category_id, notes, created_at, applied_at, summary, branches(name), categories(name)'

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { organization }) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_counts')
    .select(COUNT_COLUMNS)
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    if (MISSING_TABLE.test(error.message)) return NextResponse.json({ available: false, counts: [] })
    logger.error('No se pudieron leer las tomas de inventario', { error: error.message })
    return NextResponse.json({ error: 'No se pudieron leer las tomas de inventario' }, { status: 500 })
  }

  // Avance de las que siguen abiertas.
  const openIds = ((data ?? []) as Array<{ id: string; status: string }>).filter((count) => count.status === 'counting').map((count) => count.id)
  const progress: Record<string, { total: number; counted: number }> = {}
  if (openIds.length) {
    const { data: rows } = await supabase.from('inventory_count_items').select('count_id, counted_qty').in('count_id', openIds).limit(50000)
    for (const row of (rows ?? []) as Array<{ count_id: string; counted_qty: number | null }>) {
      const entry = progress[row.count_id] ?? { total: 0, counted: 0 }
      entry.total += 1
      if (row.counted_qty !== null) entry.counted += 1
      progress[row.count_id] = entry
    }
  }

  const { data: categories } = await supabase.from('categories').select('id, name').eq('organization_id', organization.id).order('name').limit(500)
  return NextResponse.json({
    available: true,
    counts: data ?? [],
    progress,
    categories: categories ?? [],
    canAdjust: roleHasPermission(organization.role as OrganizationRole, 'inventory.stock.manage'),
  })
})

const createSchema = z.object({
  branch_id: z.string().uuid('Elegí la sucursal'),
  name: z.string().trim().min(1).max(120),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

/** Abre una toma: guarda la foto del stock de la sucursal en ese momento. */
export const POST = withTenantAuth({ permission: 'inventory.stock.manage', module: 'inventory' }, async (request, { organization, user }) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }, { status: 400 })
  const supabase = await createClient()

  const { data: branch } = await supabase.from('branches').select('id').eq('id', parsed.data.branch_id).eq('organization_id', organization.id).maybeSingle()
  if (!branch) return NextResponse.json({ error: 'La sucursal no es de tu empresa' }, { status: 400 })

  // Una toma abierta por sucursal: dos a la vez se pisarían los ajustes.
  const { data: open } = await supabase
    .from('inventory_counts')
    .select('id, number')
    .eq('organization_id', organization.id)
    .eq('branch_id', parsed.data.branch_id)
    .eq('status', 'counting')
    .limit(1)
    .maybeSingle()
  if (open) {
    return NextResponse.json({ error: `Ya hay una toma abierta en esta sucursal (#${(open as { number: number }).number}). Terminala o anulala primero.`, countId: (open as { id: string }).id }, { status: 409 })
  }

  let items
  try {
    items = await buildCountItems(supabase, organization.id, parsed.data.branch_id, parsed.data.category_id ?? null)
  } catch (error) {
    logger.error('No se pudo leer el stock para la toma', { error })
    return NextResponse.json({ error: 'No se pudo leer el stock de la sucursal' }, { status: 500 })
  }
  if (items.length === 0) return NextResponse.json({ error: 'No hay productos para contar con ese filtro' }, { status: 400 })

  const { data: count, error } = await supabase
    .from('inventory_counts')
    .insert({
      organization_id: organization.id,
      branch_id: parsed.data.branch_id,
      name: parsed.data.name,
      category_id: parsed.data.category_id ?? null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select('id, number')
    .single()
  if (error || !count) {
    logger.error('No se pudo abrir la toma de inventario', { error: error?.message })
    return NextResponse.json({ error: 'No se pudo abrir la toma de inventario' }, { status: 500 })
  }

  const countId = (count as { id: string }).id
  for (let index = 0; index < items.length; index += 500) {
    const { error: itemsError } = await supabase
      .from('inventory_count_items')
      .insert(items.slice(index, index + 500).map((item) => ({ ...item, count_id: countId, organization_id: organization.id })))
    if (itemsError) {
      await supabase.from('inventory_counts').delete().eq('id', countId)
      logger.error('No se pudieron cargar los productos de la toma', { error: itemsError.message })
      return NextResponse.json({ error: 'No se pudieron cargar los productos de la toma' }, { status: 500 })
    }
  }

  return NextResponse.json({ count, items: items.length }, { status: 201 })
})
