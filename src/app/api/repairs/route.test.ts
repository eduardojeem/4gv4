import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/repairs', () => {
  it('returns demo repairs when Supabase is not configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    const res = await GET({} as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.repairs)).toBe(true)
    expect(data.repairs.length).toBeGreaterThan(0)
    expect(data.repairs[0]).toHaveProperty('id')
    expect(data.repairs[0]).toHaveProperty('stage')
  })
})