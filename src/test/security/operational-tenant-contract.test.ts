import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('operational private queries tenant contract', () => {
  it.each([
    ['sales hook', 'src/hooks/useSales.ts'],
    ['customers hook', 'src/hooks/use-customers.ts'],
    ['cash register hook', 'src/hooks/useCashRegister.ts'],
    ['cash monitor hook', 'src/app/admin/cash-monitor/hooks/useCashMonitor.ts'],
    ['reports', 'src/components/admin/reports/operational-reports.tsx'],
    ['product reports', 'src/components/admin/reports/product-reports.tsx'],
    ['technician schedule', 'src/app/dashboard/technician/schedule/page.tsx'],
  ])('%s uses the validated active organization', (_label, path) => {
    const source = read(path)
    expect(source).toContain('useActiveOrganization')
    expect(source).toContain('organization.id')
  })

  it('keeps sale item analytics behind tenant-scoped parent sale ids or joins', () => {
    expect(read('src/components/admin/reports/operational-reports.tsx')).toContain('completedSalesForItems.map')
    expect(read('src/components/admin/reports/product-reports.tsx')).toContain(".eq('sale.organization_id', organization.id)")
  })
})
