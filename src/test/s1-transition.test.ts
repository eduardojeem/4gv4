import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const sql = readFileSync('supabase/pending-migrations/s1-product-cost/02_cost_read_functions.sql', 'utf8')
describe('S1 deployment transition contract', () => {
  it('adds the nullable POS RPC without replacing the published numeric RPC', () => {
    expect(sql).toContain('function public.dashboard_pos_summary_s1(')
    expect(sql).not.toMatch(/create or replace function public\.dashboard_pos_summary\(/i)
  })
  it('rejects unbounded cost requests and resolves an organization', () => {
    expect(sql).toContain('p_product_ids is null or cardinality(p_product_ids) > 2000')
    expect(sql).toContain('p_variant_ids is null or cardinality(p_variant_ids) > 2000')
    expect(sql).toContain('coalesce(p_organization_id, public.current_organization_id())')
    expect(sql).not.toContain('get_product_costs() pc')
  })
})
