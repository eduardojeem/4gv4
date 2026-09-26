import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const planInfo = vi.fn()
const fetchSummary = vi.fn()
let role = 'admin'

vi.mock('@/lib/api/withAdminAuth', () => ({
  withAdminAuth: (handler: (request: NextRequest, context: unknown) => Promise<Response>) =>
    (request: NextRequest) => handler(request, { user: { id: 'u1', role }, organizationId: 'org-1' }),
}))
vi.mock('@/lib/saas/subscription-service', () => ({
  getOrganizationPlanInfo: (id: string) => planInfo(id),
}))
vi.mock('@/lib/site-analytics/server', () => ({
  fetchSiteAnalyticsSummary: (...args: unknown[]) => fetchSummary(...args),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: { name: 'Tienda', slug: 'tienda' } }),
      }
      return builder
    },
  }),
}))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: async () => null }))

const request = () => new NextRequest('http://localhost/api/admin/analytics/website?days=30')
const plan = (modules: string[], entitledModules: string[] = modules) => ({ modules, entitledModules, moduleTrials: [] })

describe('visitas web desde el plan Pro', () => {
  beforeEach(() => {
    role = 'admin'
    planInfo.mockReset()
    fetchSummary.mockReset()
    fetchSummary.mockResolvedValue({ totals: { page_views: 10 } })
  })

  it('un plan sin analytics recibe 402 y no se consultan las visitas', async () => {
    planInfo.mockResolvedValue(plan(['inventory', 'pos', 'crm', 'ecommerce']))
    const { GET } = await import('@/app/api/admin/analytics/website/route')
    const response = await GET(request())
    expect(response.status).toBe(402)
    expect((await response.json()).code).toBe('MODULE_NOT_ENTITLED')
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('Pro con el modulo apagado por la empresa recibe 403', async () => {
    planInfo.mockResolvedValue(plan(['inventory', 'pos'], ['inventory', 'pos', 'analytics']))
    const { GET } = await import('@/app/api/admin/analytics/website/route')
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('MODULE_DISABLED')
  })

  it('Pro ve sus visitas', async () => {
    planInfo.mockResolvedValue(plan(['inventory', 'pos', 'analytics']))
    const { GET } = await import('@/app/api/admin/analytics/website/route')
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(fetchSummary).toHaveBeenCalledOnce()
  })

  it('la pagina, el menu y la guia piden el mismo modulo', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/admin/visitas/page.tsx'), 'utf8')
    expect(page).toContain('module="analytics"')
    expect(page).toContain('requiredPlan="Pro"')

    const nav = readFileSync(resolve(process.cwd(), 'src/config/admin-navigation.ts'), 'utf8')
    const visitsItem = nav.slice(nav.indexOf("key: 'website-visits'"), nav.indexOf("key: 'website-visits'") + 400)
    expect(visitsItem).toContain("module: 'analytics'")

    const guide = readFileSync(resolve(process.cwd(), 'src/lib/guide/content.ts'), 'utf8')
    const visitsGuide = guide.slice(guide.indexOf("id: 'website-visits'"), guide.indexOf("id: 'website-visits'") + 600)
    expect(visitsGuide).toContain("module: 'analytics'")
  })
})
