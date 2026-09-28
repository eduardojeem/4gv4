import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  REPAIR_IMAGE_BUCKET,
  REPAIR_IMAGE_URL_TTL_SECONDS,
  repairImagePath,
  signRepairImagePath,
} from './repair-image-storage'

describe('repairImagePath', () => {
  it('preserves a normalized object path', () => {
    expect(repairImagePath('repairs/repair-1/photo.jpg')).toBe('repairs/repair-1/photo.jpg')
  })

  it('extracts a path from a historical public URL', () => {
    expect(
      repairImagePath(
        'https://example.supabase.co/storage/v1/object/public/repair-images/repairs/repair-1/photo.jpg?download=1',
      ),
    ).toBe('repairs/repair-1/photo.jpg')
  })

  it('decodes spaces and Unicode from a historical public URL', () => {
    expect(
      repairImagePath(
        'https://example.supabase.co/storage/v1/object/public/repair-images/repairs%2Freparaci%C3%B3n%201%2Ffoto%20frontal.jpg',
      ),
    ).toBe('repairs/reparación 1/foto frontal.jpg')
  })

  it.each([
    'https://example.supabase.co/storage/v1/object/public/product-images/repairs/photo.jpg',
    'https://images.example.com/repair-images/photo.jpg',
    '../secret.jpg',
    'repairs/../secret.jpg',
    'repairs/%2e%2e/secret.jpg',
    'repairs\\secret.jpg',
  ])('rejects an unsafe or foreign value: %s', (value) => {
    expect(repairImagePath(value)).toBeNull()
  })
})

describe('signRepairImagePath', () => {
  it('signs the normalized path for exactly five minutes', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.supabase.co/storage/v1/object/sign/repair-images/signed' },
      error: null,
    })
    const from = vi.fn().mockReturnValue({ createSignedUrl })
    const admin = { storage: { from } } as unknown as SupabaseClient

    await expect(signRepairImagePath(admin, 'repairs/repair-1/photo.jpg')).resolves.toBe(
      'https://example.supabase.co/storage/v1/object/sign/repair-images/signed',
    )
    expect(from).toHaveBeenCalledWith(REPAIR_IMAGE_BUCKET)
    expect(createSignedUrl).toHaveBeenCalledWith(
      'repairs/repair-1/photo.jpg',
      REPAIR_IMAGE_URL_TTL_SECONDS,
    )
  })

  it('returns null without calling Storage for an invalid path', async () => {
    const from = vi.fn()
    const admin = { storage: { from } } as unknown as SupabaseClient

    await expect(signRepairImagePath(admin, '../secret.jpg')).resolves.toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('returns null when Storage cannot sign the object', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('storage unavailable'),
    })
    const admin = {
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    } as unknown as SupabaseClient

    await expect(signRepairImagePath(admin, 'repairs/repair-1/photo.jpg')).resolves.toBeNull()
  })
})
