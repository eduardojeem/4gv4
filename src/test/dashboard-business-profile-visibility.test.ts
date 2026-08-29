import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('dashboard business profile visibility', () => {
  it('conditions repair dashboards and queries on the effective module', () => {
    const dashboard = read('src/app/dashboard/page.tsx')
    const admin = read('src/app/admin/page.tsx')
    const reports = read('src/app/dashboard/reports/page.tsx')

    expect(dashboard).toContain("effectiveModules.includes('repairs')")
    expect(dashboard).toContain('hasRepairs ?')
    expect(admin).toContain("effectiveModules.includes('repairs')")
    expect(admin).toContain('hasRepairs ?')
    expect(reports).toContain("effectiveModules.includes('repairs')")
    expect(reports).toContain('hasRepairs ?')
  })

  it('protects every repair and technician subroute with a module layout', () => {
    const repairsLayout = read('src/app/dashboard/repairs/layout.tsx')
    const technicianLayout = read('src/app/dashboard/technician/layout.tsx')

    expect(repairsLayout).toContain('<OrganizationModuleGate module="repairs">')
    expect(technicianLayout).toContain('<OrganizationModuleGate module="repairs">')
  })
})
