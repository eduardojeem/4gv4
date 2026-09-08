import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import type { AppRole } from '@/lib/auth/role-utils'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { applyBranchInventoryToProducts, loadBranchInventoryStockMap } from '@/lib/branches/inventory'
import { calculateInventoryStats, type InventoryStatsInput } from '@/lib/inventory/stock-status'

/**
 * Indicadores de inventario de TODA la empresa (y de la sucursal activa), no de
 * la pagina que se esta viendo.
 *
 * El encabezado de /admin/inventory calculaba «Stock bajo», «Valor del lote» y
 * «Margen promedio» sobre `products`, que es la pagina actual: diez productos.
 * Los tres numeros cambiaban al pasar de pagina, y estaban al lado de «Total de
 * productos», que si era global. Cuatro tarjetas identicas, una global y tres
 * no, sin ninguna marca que las distinguiera.
 */
const STATS_SCAN_CAP = 20000

export const GET = withTenantAuth(
  { permission: 'products.read', module: 'inventory' },
  async (request, { user, organization }) => {
    try {
      const requestedBranchId = getRequestedBranchId(request)
      const branchScope = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as AppRole | undefined,
        requestedBranchId,
        organizationId: organization.id,
        strict: Boolean(requestedBranchId),
      })

      const supabase = createAdminSupabase()

      // Se piden solo las columnas que entran en el calculo, y una fila de mas
      // para saber de forma confiable si el barrido quedo corto.
      const { data, error } = await supabase
        .from('products')
        .select('id, stock_quantity, min_stock, max_stock, purchase_price, sale_price')
        .eq('organization_id', organization.id)
        .is('archived_by_plan_at', null)
        .range(0, STATS_SCAN_CAP)

      if (error) {
        logger.error('Failed to read inventory stats', { error: error.message, code: error.code })
        return NextResponse.json(
          {
            success: false,
            code: error.code ?? 'INVENTORY_STATS_QUERY_FAILED',
            error: 'No se pudieron calcular los indicadores de inventario.',
          },
          { status: 500 }
        )
      }

      const rows = (data ?? []) as Array<InventoryStatsInput & { id: string }>
      const truncated = rows.length > STATS_SCAN_CAP
      const scanned = truncated ? rows.slice(0, STATS_SCAN_CAP) : rows

      const { stockMap, branchScoped, failed, error: branchError } = await loadBranchInventoryStockMap(
        supabase as unknown as Parameters<typeof loadBranchInventoryStockMap>[0],
        branchScope.branchId,
        scanned.map((product) => product.id)
      )

      // Un indicador de sucursal calculado sobre el stock global no es un
      // indicador aproximado: es el de otra pregunta.
      if (branchScope.branchId && failed) {
        logger.error('Branch stock read failed for inventory stats', {
          branchId: branchScope.branchId,
          error: branchError,
        })
        return NextResponse.json(
          {
            success: false,
            code: 'BRANCH_STOCK_UNAVAILABLE',
            error: 'No se pudo leer el inventario de la sucursal activa.',
          },
          { status: 503 }
        )
      }

      const scopedProducts = applyBranchInventoryToProducts(
        scanned as Array<{ id: string; stock_quantity?: number | null } & Record<string, unknown>>,
        stockMap,
        branchScoped
      ) as InventoryStatsInput[]

      return NextResponse.json({
        success: true,
        data: {
          ...calculateInventoryStats(scopedProducts),
          branchId: branchScope.branchId ?? null,
          branchScoped,
          // Con esto en true las cifras son parciales y la pantalla lo dice.
          truncated,
          scanCap: truncated ? STATS_SCAN_CAP : undefined,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Inventory stats API error', { error, message })
      return NextResponse.json(
        {
          success: false,
          code: 'INVENTORY_STATS_UNEXPECTED_ERROR',
          error: `No se pudieron calcular los indicadores: ${message}`,
        },
        { status: 500 }
      )
    }
  }
)
