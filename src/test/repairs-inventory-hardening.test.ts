import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildQuickStockAdjustment } from '@/lib/repairs/inventory-stock-adjustment'
import { isServiceLikeProduct } from '@/lib/products/is-service-like'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('ajustes rápidos del inventario del taller', () => {
  it('envía una variación de una unidad y conserva el stock observado', () => {
    expect(buildQuickStockAdjustment(5, 1)).toEqual({
      quantityChange: 1,
      expectedPreviousStock: 5,
    })
    expect(buildQuickStockAdjustment(5, -1)).toEqual({
      quantityChange: -1,
      expectedPreviousStock: 5,
    })
  })

  it('no permite reducir un stock que ya está en cero', () => {
    expect(buildQuickStockAdjustment(0, -1)).toBeNull()
  })
})

describe('clasificación compartida de servicios y repuestos', () => {
  it('no confunde el nombre de una pieza con un servicio', () => {
    expect(isServiceLikeProduct({ name: 'Cambio de vidrio', unit_measure: 'unidad' })).toBe(false)
  })

  it('reconoce servicios por metadatos estables', () => {
    expect(isServiceLikeProduct({ name: 'Diagnóstico', unit_measure: 'servicio' })).toBe(true)
    expect(isServiceLikeProduct({ name: 'Limpieza', sku: 'SRV-001' })).toBe(true)
    expect(isServiceLikeProduct({ name: 'Trabajo técnico', category: { name: 'Mano de obra' } })).toBe(true)
  })
})

describe('inventario completo y límites del plan', () => {
  it('el taller solicita el catálogo completo mediante la opción dedicada', () => {
    const context = read('src/app/dashboard/repairs/inventory/context/InventoryContext.tsx')
    expect(context).toContain('useProductsSupabase({ loadAllProducts: true })')
    expect(context).not.toContain('limit: 1000')
  })

  it('servicios y productos físicos no consumen dos veces el mismo cupo', () => {
    const subscription = read('src/lib/saas/subscription-service.ts')
    expect(subscription).toContain(".or('unit_measure.is.null,unit_measure.neq.servicio')")
    expect(subscription).toContain(".eq('unit_measure', 'servicio')\n    .is('archived_by_plan_at', null)")
  })
})

describe('aislamiento tenant de repair_parts', () => {
  it('cada política relaciona la pieza con una reparación autorizada', () => {
    const migration = read('supabase/migrations/20261004212358_harden_repair_parts_tenant_policies.sql')
    expect(migration).toContain('repair_parts_select_tenant')
    expect(migration).toContain('repair_parts_insert_tenant')
    expect(migration).toContain('repair_parts_update_tenant')
    expect(migration).toContain('repair_parts_delete_tenant')
    expect(migration).toContain('revoke all on table public.repair_parts from anon')
    expect(migration).toContain('revoke insert, update, delete on table public.repair_parts from authenticated')
    expect(migration).toContain('repair.id = repair_parts.repair_id')
    expect(migration).toContain("has_org_permission(repair.organization_id, 'repairs.orders.read')")
    expect(migration).toContain("has_org_permission(repair.organization_id, 'repairs.orders.update')")
  })
})
