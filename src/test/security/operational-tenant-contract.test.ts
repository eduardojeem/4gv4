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
    ['reports', 'src/app/dashboard/reports/page.tsx'],
    ['product reports', 'src/app/dashboard/reports/products/page.tsx'],
    ['technician schedule', 'src/app/dashboard/technician/schedule/page.tsx'],
  ])('%s uses the validated active organization', (_label, path) => {
    const source = read(path)
    expect(source).toContain('useActiveOrganization')
    expect(source).toContain('organization.id')
  })

  it('keeps sale item analytics behind tenant-scoped parent sale ids or joins', () => {
    expect(read('src/app/dashboard/reports/page.tsx')).toContain('completedSalesForItems.map')
    expect(read('src/app/dashboard/reports/products/page.tsx')).toContain(".eq('sale.organization_id', organization.id)")
  })
})
