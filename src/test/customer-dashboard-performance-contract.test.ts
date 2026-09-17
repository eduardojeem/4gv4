import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('customer dashboard avoids duplicate work and remains usable on mobile', () => {
  const dashboard = read('src/components/dashboard/customers/CustomerDashboard.tsx')
  const list = read('src/components/dashboard/customers/CustomerListView.tsx')
  const metrics = read('src/hooks/use-customer-metrics.ts')

  it('loads the full credits ledger only when its tab is open', () => {
    expect(dashboard).toContain("useCredits(hasCreditsModule && activeTab === 'credits')")
  })

  it('does not request customer spend a second time inside the list', () => {
    expect(list).not.toContain('useCustomerSalesMetricsMap')
    expect(list).toContain('const metricsMap = useMemo<Record<string, CustomerMetrics>>')
  })

  it('uses the dashboard search when controlled instead of rendering a second field', () => {
    expect(list).toContain('{!isControlled && (')
  })

  it('uses cards on mobile and the table from md upward', () => {
    expect(list).toContain('className="md:hidden"')
    expect(list).toContain('className="hidden md:block"')
  })

  it('keeps action menus visible on touch and names icon-only controls', () => {
    expect(list).toContain('aria-label={`Acciones de ${customer.name}`}')
    expect(list).not.toContain('opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100')
    expect(list).toContain('aria-label="Vista de tabla"')
    expect(list).toContain('aria-label="Vista de tarjetas"')
  })

  it('scopes monthly sales analytics to the active organization', () => {
    expect(metrics).toContain('useOptionalActiveOrganization()')
    expect(metrics).toContain(".eq('organization_id', organizationId)")
  })

  it('includes repair balances in the batched customer debt summary', () => {
    const route = read('src/app/api/credits/batch/route.ts')
    const creditsHook = read('src/hooks/use-customer-credits.ts')
    expect(route).toContain(".from('repairs')")
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain('repairDebts: summarizeRepairDebts')
    expect(creditsHook).toContain('repairDebtsData')
    expect(creditsHook).toContain('installmentPending + repairPending')
    expect(dashboard).toContain('summaries.filter(s => s.overdue_debt > 0).length')
  })

  it('does not advertise an import shortcut that opens no dialog', () => {
    expect(dashboard).not.toContain('setShowImportDialog')
    expect(dashboard).not.toContain('customerDashboardShortcuts.import')
    expect(dashboard).not.toContain("{ keys: ['Ctrl', 'I']")
  })
})
