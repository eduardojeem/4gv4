import { NextRequest, NextResponse } from 'next/server'
import { isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'

function safeSearchTerm(value: string) {
  return value.trim().replace(/[%_,().]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    const query = safeSearchTerm(new URL(request.url).searchParams.get('q') ?? '')
    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Ingresá al menos 2 caracteres para buscar.', code: 'REPAIR_INVENTORY_QUERY_TOO_SHORT' },
        { status: 400 },
      )
    }

    const { data: products, error: productsError } = await ctx.supabase
      .from('products')
      .select('id, sku, name, purchase_price, sale_price, tax_rate, updated_at')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(20)
    if (productsError) throw productsError

    const productIds = (products ?? []).map((product) => product.id)
    const inventoryResult = productIds.length === 0
      ? { data: [], error: null }
      : await ctx.supabase
          .from('branch_inventory')
          .select('product_id, stock_quantity, updated_at')
          .eq('branch_id', ctx.branchId)
          .in('product_id', productIds)
    if (inventoryResult.error) throw inventoryResult.error

    const stockByProduct = new Map(
      (inventoryResult.data ?? []).map((row) => [row.product_id, row]),
    )
    const items = (products ?? []).map((product) => {
      const stock = stockByProduct.get(product.id)
      return {
        productId: product.id,
        sku: product.sku ?? '',
        name: product.name,
        availableStock: Number(stock?.stock_quantity ?? 0),
        unitCost: Number(product.purchase_price ?? 0),
        unitPrice: Number(product.sale_price ?? 0),
        taxRate: [0, 5, 10].includes(Number(product.tax_rate)) ? Number(product.tax_rate) : 10,
        version: `${product.updated_at ?? ''}:${stock?.updated_at ?? ''}`,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[repair-inventory-search] Unexpected search failure', error)
    return NextResponse.json({ error: 'No se pudo consultar el inventario.' }, { status: 500 })
  }
}
