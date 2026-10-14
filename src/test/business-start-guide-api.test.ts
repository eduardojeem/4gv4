import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state = vi.hoisted(() => ({ auth: { user: { id: 'actor' } } as unknown, load: vi.fn(), save: vi.fn() }))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: () => Promise.resolve(state.auth) }))
vi.mock('@/lib/onboarding/start-guide-server', () => ({ loadStartGuide: state.load, saveStartGuidePreferences: state.save }))
import { GET, PATCH } from '@/app/api/onboarding/start-guide/route'
beforeEach(() => { state.auth = { user: { id: 'actor' } }; state.load.mockReset(); state.save.mockReset() })
const request = (body?: unknown, organizationId?: string) => new NextRequest('http://localhost/api/onboarding/start-guide', { method: body ? 'PATCH' : 'GET', headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(organizationId ? { 'x-organization-id': organizationId } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
describe('business start guide API', () => {
  it('denies unauthenticated reads', async () => {
    state.auth = { reason: 'unauthenticated' }
    expect((await GET(request())).status).toBe(401)
    expect(state.load).not.toHaveBeenCalled()
  })
  it('does not return evidence for a previous organization', async () => {
    state.load.mockResolvedValue({ organizationId: 'new-org', guide: { tasks: [] } })
    const response = await GET(request(undefined, 'old-org'))
    expect(response.status).toBe(409)
    expect(await response.text()).not.toContain('tasks')
  })
  it('preserves forbidden branch or role status without leaking internals', async () => {
    state.load.mockRejectedValue(Object.assign(new Error('private database detail'), { status: 403 }))
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('private database')
  })
  it('query failure is not a false completed guide', async () => {
    state.load.mockRejectedValue(new Error('database secret'))
    expect((await GET(request())).status).toBe(500)
  })
  it('rejects writing calculated completion through preferences', async () => {
    const response = await PATCH(request({ version: 1, teamMode: 'solo', postponed: true, completed: true }))
    expect(response.status).toBe(400)
    expect(state.save).not.toHaveBeenCalled()
  })
  it('saves only validated preferences with expected organization', async () => {
    state.save.mockResolvedValue(undefined)
    const response = await PATCH(request({ version: 1, teamMode: 'team', postponed: true }, 'org'))
    expect(response.status).toBe(200)
    expect(state.save).toHaveBeenCalledWith('actor', { version: 1, teamMode: 'team', postponed: true }, 'org')
  })
})
