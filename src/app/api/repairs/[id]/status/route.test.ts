import { describe, it, expect } from 'vitest'
import { PATCH } from './route'

describe('PATCH /api/repairs/:id/status', () => {
  it('returns ok and echoes stage in demo mode', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    const req = { json: async () => ({ stage: 'ready' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'K-001' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.id).toBe('K-001')
    expect(data.stage).toBe('ready')
  })
})