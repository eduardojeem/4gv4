import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'src/components/admin/reports/operational-reports.tsx'),
  'utf8',
)

describe('admin reports resource usage', () => {
  it('persists the active tab and period in the URL', () => {
    expect(source).toContain("searchParams.get('tab')")
    expect(source).toContain("searchParams.get('period')")
    expect(source).toContain("params.set('tab', nextTab)")
    expect(source).toContain("params.set('period', nextPeriod)")
    expect(source).toContain('<Tabs value={activeTab} onValueChange={handleTabChange}')
  })

  it('loads module-specific report data only when its tab needs it', () => {
    expect(source).toContain("const needsProductData = activeTab === 'products' || activeTab === 'categories'")
    expect(source).toContain("const needsRepairData = activeTab === 'repairs'")
    expect(source).toContain("if (needsProductData)")
    expect(source).toContain("= needsRepairData ? await withBranchFilter(")
    expect(source).toContain("if (activeTab !== 'credits'")
  })

  it('subscribes to realtime changes only for the active report', () => {
    expect(source).toContain("...(needsProductData ? ['sale_items'] : [])")
    expect(source).toContain("...(needsRepairData ? ['repairs'] : [])")
    expect(source).toContain("...(activeTab === 'credits'")
  })
})
