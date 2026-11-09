import { beforeEach, describe, expect, it, vi } from 'vitest'
const { authorize, load } = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: authorize }))
vi.mock('@/lib/website/template-usage.server', () => ({ loadTemplateUsage: load }))
import { GET } from '@/app/api/superadmin/storefront-templates/usage/route'
describe('template usage authorization', () => {
 beforeEach(() => vi.clearAllMocks())
 it('does not read any usage without superadmin authorization', async () => {
  authorize.mockResolvedValue(null)
  expect((await GET()).status).toBe(401)
  expect(load).not.toHaveBeenCalled()
 })
 it('returns private uncached counts to superadmin', async () => {
  authorize.mockResolvedValue({ id: 'superadmin' })
  load.mockResolvedValue({ total: 2, counts: { tech: 2 } })
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ usage: { total: 2, counts: { tech: 2 } } })
 })
})
