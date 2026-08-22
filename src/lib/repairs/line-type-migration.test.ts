import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260821043722_add_repair_line_types.sql',
), 'utf8')

describe('classified repair pricing migration', () => {
  it('persists line classification in current rows and immutable snapshots', () => {
    expect(sql).toContain('repair_parts_line_type_check')
    expect(sql).toContain('line_type_snapshot')
    expect(sql).toContain('services_subtotal')
    expect(sql).toContain('included_materials_internal_cost')
  })

  it('never consumes inventory for service lines', () => {
    expect(sql).toContain("resolved_line_type <> 'service'")
    expect(sql).toContain("part.line_type <> 'service'")
  })

  it('allows included material cost without treating it as a below-cost sale', () => {
    expect(sql).toContain("resolved_line_type = 'charged_part' and resolved_subtotal")
    expect(sql).toContain("elsif resolved_line_type = 'included_material'")
    expect(sql).toContain("resolved_unit_price := 0")
  })

  it('resolves wholesale service and part prices inside the atomic operation', () => {
    expect(sql).toContain('customer_is_wholesale and product_wholesale_price > 0')
    expect(sql).toContain('else product_sale_price end')
  })
})
