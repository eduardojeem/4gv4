import { describe, expect, it, vi } from 'vitest'
import { loadDashboardProfile, saveDashboardProfile } from '@/lib/profile/dashboard-profile-client'

const profile = { id: 'user-1', fullName: 'Ana', preferences: { notifications: true } }

describe('dashboard profile persistence client', () => {
  it('loads the authoritative profile from the server', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ profile }), { status: 200 }))
    await expect(loadDashboardProfile(fetcher)).resolves.toEqual(profile)
    expect(fetcher).toHaveBeenCalledWith('/api/dashboard/profile', expect.objectContaining({ cache: 'no-store' }))
  })

  it('throws on a failed save so callers keep dirty state', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'db failed' }), { status: 500 }))
    await expect(saveDashboardProfile({ bio: 'Hola' }, fetcher)).rejects.toThrow('db failed')
  })

  it('returns partial synchronization without converting it to full success', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ profile, partial: true }), { status: 207 }))
    await expect(saveDashboardProfile({ fullName: 'Ana' }, fetcher)).resolves.toEqual({ profile, partial: true })
  })

  it('returns authoritative profile data after a successful save', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ profile, partial: false }), { status: 200 }))
    await expect(saveDashboardProfile({ bio: 'Hola' }, fetcher)).resolves.toEqual({ profile, partial: false })
    expect(fetcher).toHaveBeenCalledWith('/api/dashboard/profile', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ bio: 'Hola' }),
    }))
  })
})
