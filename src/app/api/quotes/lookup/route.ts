import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { organizationCurrency } from '@/lib/quotes/quote-server'

export const dynamic = 'force-dynamic'

const PRODUCT_COLUMNS = 'id, name, sku, barcode, sale_price, wholesale_price, stock_quantity, unit_measure, has_variants, image_url, product_variants(id, variant_name, sku, sale_price, wholesale_price, stock_quantity, is_active)'
const FREQUENT_LIMIT = 8
const FREQUENT_WINDOW_DAYS = 90

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Lo que la empresa más vende en los últimos 90 días, para tenerlo a un clic al
 * presupuestar. Sin ventas todavía, lo último que cargó al catálogo.
 */
async function frequentCatalogProducts(supabase: Supabase, organizationId: string) {
  const since = new Date(Date.now() - FREQUENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: sold } = await supabase
    .from('sale_items')
    .select('product_id, quantity')
    .eq('organization_id', organizationId)
    .gte('created_at', since)
    .not('product_id', 'is', null)
    .limit(2000)

  const units = new Map<string, number>()
  for (const row of (sold ?? []) as Array<{ product_id: string | null; quantity: number | null }>) {
    if (!row.product_id) continue
    units.set(row.product_id, (units.get(row.product_id) ?? 0) + (Number(row.quantity) || 1))
  }
  const topIds = [...units.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, FREQUENT_LIMIT * 2)

  if (topIds.length > 0) {
    const { data } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .in('id', topIds)
    const rank = new Map(topIds.map((id, index) => [id, index]))
    const ranked = ((data ?? []) as Array<{ id: string }>).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    if (ranked.length > 0) return ranked.slice(0, FREQUENT_LIMIT)
  }

  const { data: recent } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(FREQUENT_LIMIT)
  return recent ?? []
}

/**
 * Búsqueda liviana para el editor de presupuestos: productos (con sus
 * variantes y precios) o clientes, de la empresa activa.
 */
export const GET = withTenantAuth({ permission: 'pos.sales.create', module: 'pos' }, async (request, { organization }) => {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('type') === 'meta') {
    const supabase = await createClient()
    return NextResponse.json({ currency: await organizationCurrency(supabase, organization.id), storeName: organization.name })
  }
  if (searchParams.get('type') === 'frequent') {
    const supabase = await createClient()
    return NextResponse.json({ results: await frequentCatalogProducts(supabase, organization.id) })
  }
  const type = searchParams.get('type') === 'customers' ? 'customers' : 'products'
  // Se interpola en un filtro `or` de PostgREST.
  const term = (searchParams.get('q') ?? '').replace(/[,()%*\\:"']/g, ' ').trim().slice(0, 60)
  if (term.length < 2) return NextResponse.json({ results: [] })
  const supabase = await createClient()

  if (type === 'customers') {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, whatsapp, email, ruc')
      .eq('organization_id', organization.id)
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%,ruc.ilike.%${term}%,email.ilike.%${term}%`)
      .order('name')
      .limit(10)
    return NextResponse.json({ results: data ?? [] })
  }

  const { data } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.eq.${term},brand.ilike.%${term}%`)
    .order('name')
    .limit(12)
  return NextResponse.json({ results: data ?? [] })
})
