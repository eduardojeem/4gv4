import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { signRepairImages } from './sign-repair-images'

describe('signRepairImages', () => {
  it('signs path and historical URL rows without exposing their stored references', async () => {
    const createSignedUrl = vi.fn(async (path: string) => ({
      data: { signedUrl: `https://signed.example/${encodeURIComponent(path)}` },
      error: null,
    }))
    const admin = {
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as unknown as SupabaseClient

    const rows = await signRepairImages(admin, [
      { id: 'one', image_url: 'repairs/r1/front.jpg' },
      {
        id: 'two',
        image_url: 'https://project.supabase.co/storage/v1/object/public/repair-images/repairs/r1/foto%20atr%C3%A1s.jpg',
      },
    ])

    expect(rows).toEqual([
      { id: 'one', image_url: 'https://signed.example/repairs%2Fr1%2Ffront.jpg' },
      { id: 'two', image_url: 'https://signed.example/repairs%2Fr1%2Ffoto%20atr%C3%A1s.jpg' },
    ])
  })

  it('returns null for invalid references and signing failures', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error('unavailable') })
    const admin = {
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as unknown as SupabaseClient

    const rows = await signRepairImages(admin, [
      { id: 'invalid', image_url: 'https://attacker.example/photo.jpg' },
      { id: 'failed', image_url: 'repairs/r1/missing.jpg' },
    ])

    expect(rows).toEqual([
      { id: 'invalid', image_url: null },
      { id: 'failed', image_url: null },
    ])
    expect(createSignedUrl).toHaveBeenCalledTimes(1)
  })
})
