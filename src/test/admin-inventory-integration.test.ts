import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('admin inventory integration contracts', () => {
  it('synchronizes edited commercial features into technical plan modules', () => {
    const route = read('src/app/api/superadmin/subscription-plans/[id]/route.ts')
    const migration = read(
      'supabase/migrations/20260802212650_sync_inventory_admin_plan_module.sql'
    )

    expect(route).toContain('deriveTechnicalModules')
    expect(route).toContain(".from('plans')")
    expect(route).toContain('modules: deriveTechnicalModules(plan.tier, plan.features)')
    expect(migration).toContain("when 'inventario avanzado' then 'inventory_admin'")
    expect(migration).toContain('sync_technical_plan_from_subscription_plan')
  })

  it('loads and writes products through the selected branch contract', () => {
    const inventoryHook = read('src/hooks/use-inventory.ts')

    expect(inventoryHook).toContain('useBranch()')
    expect(inventoryHook).toContain('branchHeaders(selectedBranchId)')
    expect(inventoryHook).toContain('strict_branch_stock')
    expect(inventoryHook).not.toContain(".from('products')")
  })

  it('debounces catalog searches and cancels stale product requests', () => {
    const inventoryHook = read('src/hooks/use-inventory.ts')

    expect(inventoryHook).toContain('debouncedSearch')
    expect(inventoryHook).toContain('window.setTimeout')
    expect(inventoryHook).toContain('AbortController')
    expect(inventoryHook).toContain('signal: requestController.signal')
  })
})
