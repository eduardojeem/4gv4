import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { organizationCurrency } from '@/lib/quotes/quote-server'

export const dynamic = 'force-dynamic'

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
    .select('id, name, sku, barcode, sale_price, wholesale_price, stock_quantity, unit_measure, has_variants, image_url, product_variants(id, variant_name, sku, sale_price, wholesale_price, stock_quantity, is_active)')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.eq.${term},brand.ilike.%${term}%`)
    .order('name')
    .limit(12)
  return NextResponse.json({ results: data ?? [] })
})
