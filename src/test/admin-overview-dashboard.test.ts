import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin overview dashboard design & structure', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')

  it('preserves navigation config integration', () => {
    expect(source).toContain('adminNavCategories')
    expect(source).toContain('filterCategoriesByPermissions')
  })

  it('preserves repairs module conditioning', () => {
    expect(source).toContain("effectiveModules.includes('repairs')")
    expect(source).toContain('hasRepairs ?')
  })

  it('integrates executive overview metrics for balanced business monitoring', () => {
    expect(source).toContain('useAdminOverviewMetrics')
    expect(source).toContain('todaySalesTotal')
    expect(source).toContain('openCashRegisters')
    expect(source).toContain('lowStockCount')
  })

  it('includes quick action pills for direct navigation', () => {
    expect(source).toContain('/admin/cash-monitor')
    expect(source).toContain('/admin/finances')
    expect(source).toContain('/admin/inventory')
    expect(source).toContain('/admin/users')
    expect(source).toContain('/admin/settings')
  })

  it('organizes content using structured tabs to avoid vertical clutter', () => {
    expect(source).toContain('<Tabs')
    expect(source).toContain('Panorama General')
    expect(source).toContain('Módulos y Gestión')
  })

  it('provides an actionable operational attention banner for alerts', () => {
    expect(source).toContain('hasUrgentAttention')
    expect(source).toContain('cashAlertsCount')
  })
})
