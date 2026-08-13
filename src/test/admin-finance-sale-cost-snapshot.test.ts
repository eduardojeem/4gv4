import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const migration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260812103000_capture_immutable_pos_sale_costs.sql'),
  'utf8',
).toLowerCase()
const financeServer = readFileSync(resolve(workspace, 'src/lib/finance/server.ts'), 'utf8')

describe('POS historical COGS snapshots', () => {
  it('captures an immutable, organization-and-branch-scoped product cost when a sale item is written', () => {
    expect(migration).toContain('create table if not exists public.sale_item_cost_snapshots')
    expect(migration).toContain('foreign key (organization_id, branch_id)')
    expect(migration).toContain('references public.branches (organization_id, id)')
    expect(migration).toContain('create trigger sale_items_capture_cost_snapshot')
    expect(migration).toContain('after insert on public.sale_items')
    expect(migration).toContain('nullif(product.purchase_price, 0)')
    expect(migration).toContain('before update or delete on public.sale_item_cost_snapshots')
  })

  it('loads persisted sale-item snapshots rather than a current product or unused product-movement cost', () => {
    expect(financeServer).toContain(".from('sale_item_cost_snapshots')")
    expect(financeServer).not.toContain(".from('product_movements')")
  })
})
