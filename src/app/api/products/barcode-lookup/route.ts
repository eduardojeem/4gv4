import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { barcodeSpellings, classifyBarcode, gtinKey } from '@/lib/products/barcode-catalog'
import { lookupOpenFacts, openFactsSourcesFor } from '@/lib/products/open-product-facts'

/**
 * GET /api/products/barcode-lookup?code=...&excludeId=...
 *
 * Al cargar un producto con su código de barras:
 *  - avisa si la tienda ya tiene ese código (en un producto o una variante),
 *    porque la tabla no lo impide y terminaba con el mismo producto dos veces;
 *  - si es un código del fabricante y está en el catálogo global, devuelve sus
 *    datos con la marca y la categoría de ESTA tienda que les corresponden,
 *    para completar el formulario;
 *  - si no está, lo busca en Open Food Facts / Open Beauty Facts según el rubro
 *    (alimentos, limpieza, cosmética), con la fuente para la atribución.
 */
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request, { organization }) => {
  const params = new URL(request.url).searchParams
  const { code, kind } = classifyBarcode(params.get('code'))
  const excludeId = params.get('excludeId')
  if (kind === 'empty') return NextResponse.json({ success: true, data: { code, kind, own: null, global: null } })

  try {
    const admin = createAdminSupabase()
    const spellings = barcodeSpellings(code)

    let productQuery = admin
      .from('products')
      .select('id, name')
      .eq('organization_id', organization.id)
      .in('barcode', spellings)
      .limit(1)
    if (excludeId) productQuery = productQuery.neq('id', excludeId)

    let variantQuery = admin
        .from('product_variants')
        .select('product_id, variant_name, products!inner(name)')
        .eq('organization_id', organization.id)
        .in('barcode', spellings)
        .limit(1)
    if (excludeId) variantQuery = variantQuery.neq('product_id', excludeId)

    const [{ data: ownProducts, error: productError }, { data: ownVariants, error: variantError }, { data: organizationRow }] = await Promise.all([
      productQuery,
      variantQuery,
      admin.from('organizations').select('business_vertical').eq('id', organization.id).maybeSingle(),
    ])
    if (productError || variantError) throw new Error('No se pudieron verificar los duplicados del código')

    const variant = (ownVariants ?? [])[0] as unknown as { product_id: string; variant_name: string | null; products: { name: string } | Array<{ name: string }> } | undefined
    const variantProduct = variant ? (Array.isArray(variant.products) ? variant.products[0] : variant.products) : null
    const own = ownProducts?.[0]
      ? { id: ownProducts[0].id as string, name: ownProducts[0].name as string, variant: null }
      : variant && variant.product_id !== excludeId
        ? { id: variant.product_id, name: variantProduct?.name ?? 'Producto', variant: variant.variant_name }
        : null

    const gtin = gtinKey(code)
    let global: Record<string, unknown> | null = null
    if (gtin) {
      const { data: match, error } = await admin
        .from('global_products')
        .select('id, gtin, name, brand_name, global_brand_id, global_category_id, description, image_url, global_brands(name), global_categories(name)')
        .eq('gtin', gtin)
        .eq('is_active', true)
        .eq('catalog_status', 'published')
        .maybeSingle()

      // Sin la tabla del catálogo (SQL sin correr) solo se avisa de duplicados.
      if (!error && match) {
        const row = match as unknown as {
          id: string; gtin: string; name: string; brand_name: string | null; global_brand_id: string | null
          global_category_id: string | null; description: string | null; image_url: string | null
          global_brands: { name: string } | null; global_categories: { name: string } | null
        }
        const [{ data: tenantBrand }, { data: tenantCategory }] = await Promise.all([
          row.global_brand_id
            ? admin.from('brands').select('id, name').eq('organization_id', organization.id).eq('global_brand_id', row.global_brand_id).limit(1).maybeSingle()
            : Promise.resolve({ data: null }),
          row.global_category_id
            ? admin.from('categories').select('id, name').eq('organization_id', organization.id).eq('global_category_id', row.global_category_id).limit(1).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        global = {
          id: row.id,
          gtin: row.gtin,
          name: row.name,
          description: row.description,
          imageUrl: row.image_url,
          brandName: row.global_brands?.name ?? row.brand_name,
          categoryName: row.global_categories?.name ?? null,
          /** La marca y la categoría de esta tienda que corresponden, si las tiene. */
          tenantBrandId: (tenantBrand as { id: string } | null)?.id ?? null,
          tenantCategoryId: (tenantCategory as { id: string } | null)?.id ?? null,
          source: 'catalog',
          sourceUrl: null,
        }
      }
    }

    // Fuera del catálogo: las bases abiertas, si el rubro tiene sentido para ellas.
    if (gtin && !global) {
      const vertical = (organizationRow as { business_vertical?: string | null } | null)?.business_vertical ?? null
      const external = await lookupOpenFacts(gtin, openFactsSourcesFor(vertical))
      if (external) {
        // La marca de la tienda con el mismo nombre, si ya la cargó.
        const { data: tenantBrand } = external.brandName
          ? await admin
            .from('brands')
            .select('id')
            .eq('organization_id', organization.id)
            .ilike('name', external.brandName.replace(/[\\%_]/g, (char) => `\\${char}`))
            .limit(1)
            .maybeSingle()
          : { data: null }
        global = {
          id: `${external.source}:${external.gtin}`,
          gtin: external.gtin,
          name: external.name,
          description: external.description,
          imageUrl: external.imageUrl,
          brandName: external.brandName,
          categoryName: null,
          tenantBrandId: (tenantBrand as { id: string } | null)?.id ?? null,
          tenantCategoryId: null,
          source: external.source,
          sourceUrl: external.sourceUrl,
        }
      }
    }

    return NextResponse.json({ success: true, data: { code, kind, own, global } })
  } catch (error) {
    logger.error('[products/barcode-lookup] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo buscar el código.' }, { status: 500 })
  }
})
