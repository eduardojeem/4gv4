import { NextRequest, NextResponse } from 'next/server'
import { isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'
import { isServiceLikeProduct } from '@/lib/products/is-service-like'

function safeSearchTerm(value: string) {
  return value.trim().replace(/[%_,().]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx
    const url = new URL(request.url)
    const query = safeSearchTerm(url.searchParams.get('q') ?? '')
    const repairId = url.searchParams.get('repairId')?.trim() || null
    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Ingresá al menos 2 caracteres para buscar.', code: 'REPAIR_INVENTORY_QUERY_TOO_SHORT' },
        { status: 400 },
      )
    }

    let customerIsWholesale = false
    if (repairId) {
      const { data: scopedRepair, error: repairError } = await ctx.supabase
        .from('repairs')
        .select('id, customer:customers!customer_id(customer_type)')
        .eq('id', repairId)
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .maybeSingle()
      if (repairError) throw repairError
      if (!scopedRepair) {
        return NextResponse.json({ error: 'Reparación no encontrada.' }, { status: 404 })
      }
      const customer = Array.isArray(scopedRepair.customer) ? scopedRepair.customer[0] : scopedRepair.customer
      const customerType = String(customer?.customer_type ?? '').toLowerCase()
      customerIsWholesale = customerType === 'wholesale' || customerType === 'mayorista'
    }

    const { data: products, error: productsError } = await ctx.supabase
      .from('products')
      .select('id, sku, name, purchase_price, sale_price, wholesale_price, tax_rate, unit_measure, updated_at')
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
      const isService = isServiceLikeProduct(product)
      const wholesalePrice = Number(product.wholesale_price ?? 0)
      const retailPrice = Number(product.sale_price ?? 0)
      const wholesalePriceApplied = customerIsWholesale && wholesalePrice > 0
      const wholesalePriceFallback = customerIsWholesale && wholesalePrice <= 0
      const internalCost = Number(product.purchase_price ?? 0)
      return {
        productId: product.id,
        sku: product.sku ?? '',
        name: product.name,
        availableStock: isService ? null : Number(stock?.stock_quantity ?? 0),
        unitCost: isService ? 0 : internalCost,
        includedMaterialCost: isService ? internalCost : 0,
        unitPrice: wholesalePriceApplied ? wholesalePrice : retailPrice,
        retailPrice,
        wholesalePrice: wholesalePrice > 0 ? wholesalePrice : null,
        wholesalePriceApplied,
        wholesalePriceFallback,
        lineType: isService ? 'service' : 'charged_part',
        taxRate: [0, 5, 10].includes(Number(product.tax_rate)) ? Number(product.tax_rate) : 10,
        version: `${product.updated_at ?? ''}:${stock?.updated_at ?? ''}`,
      }
    })

    return NextResponse.json({ items, customerIsWholesale })
  } catch (error) {
    console.error('[repair-inventory-search] Unexpected search failure', error)
    return NextResponse.json({ error: 'No se pudo consultar el inventario.' }, { status: 500 })
  }
}
