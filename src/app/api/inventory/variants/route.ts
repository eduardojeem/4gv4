import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import type { AppRole } from '@/lib/auth/role-utils'
import { getDefaultBranch, getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { summarizeVariantProducts, type VariantSyncProduct, type VariantSyncRow } from '@/lib/inventory/variant-sync'

export const dynamic = 'force-dynamic'

type VariantRow = Omit<VariantSyncRow, 'branch_stock'>

/**
 * Productos con variantes y, para cada variante, si se puede cobrar en la
 * sucursal: las mismas condiciones que exige la venta del punto de venta.
 */
export const GET = withTenantAuth(
  { permission: 'products.read', module: 'inventory' },
  async (request, { user, organization }) => {
    try {
      const requestedBranchId = getRequestedBranchId(request)
      const scope = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as AppRole | undefined,
        requestedBranchId,
        organizationId: organization.id,
        strict: Boolean(requestedBranchId),
      })
      const branchId = scope.branchId ?? (await getDefaultBranch(organization.id))?.id ?? null
      const supabase = createAdminSupabase()

      const variants = await fetchAllRows<VariantRow>((from, to) => supabase
        .from('product_variants')
        .select('id, product_id, variant_name, sku, is_active, sale_price, wholesale_price')
        .eq('organization_id', organization.id)
        .order('created_at')
        .range(from, to) as unknown as PromiseLike<{ data: VariantRow[] | null; error: { message: string } | null }>)

      const productIds = [...new Set(variants.map((variant) => variant.product_id))]
      const variantIds = variants.map((variant) => variant.id)

      const products: VariantSyncProduct[] = []
      for (const ids of chunkValues(productIds)) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, sku, image_url, sale_price, wholesale_price')
          .eq('organization_id', organization.id)
          .is('archived_by_plan_at', null)
          .in('id', ids)
        if (error) throw new Error(error.message)
        products.push(...((data ?? []) as VariantSyncProduct[]))
      }

      const branchStock = new Map<string, number>()
      if (branchId) {
        for (const ids of chunkValues(variantIds)) {
          const { data, error } = await supabase
            .from('branch_variant_inventory')
            .select('variant_id, stock_quantity')
            .eq('organization_id', organization.id)
            .eq('branch_id', branchId)
            .in('variant_id', ids)
          if (error) throw new Error(error.message)
          for (const row of (data ?? []) as Array<{ variant_id: string; stock_quantity: number | null }>) {
            branchStock.set(row.variant_id, Number(row.stock_quantity ?? 0))
          }
        }
      }

      const rows: VariantSyncRow[] = variants.map((variant) => ({
        ...variant,
        branch_stock: branchStock.has(variant.id) ? branchStock.get(variant.id) ?? 0 : null,
      }))

      return NextResponse.json({
        success: true,
        data: {
          branchId,
          products: summarizeVariantProducts(products, rows),
        },
      })
    } catch (error) {
      logger.error('Inventory variants API error', { error: error instanceof Error ? error.message : String(error) })
      return NextResponse.json(
        { success: false, error: 'No se pudieron revisar las variantes.' },
        { status: 500 },
      )
    }
  },
)
