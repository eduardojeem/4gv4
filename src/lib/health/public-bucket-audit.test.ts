import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { auditPublicBuckets } from './public-bucket-audit'

function adminWithList(list: ReturnType<typeof vi.fn>) {
  return {
    storage: { from: vi.fn(() => ({ list })) },
  } as unknown as SupabaseClient
}

describe('auditPublicBuckets', () => {
  it('classifies a public repair-images bucket as a high-severity error', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ name: 'photo.jpg', metadata: { mimetype: 'image/jpeg' } }],
      error: null,
    })

    const result = await auditPublicBuckets(adminWithList(list), [
      { id: 'repair-images', public: true },
    ])

    expect(result.status).toBe('error')
    expect(result.severity).toBe('high')
    expect(result.findings.join(' ')).toContain('repair-images')
    expect(result.findings.join(' ')).not.toContain('photo.jpg')
  })

  it('permits public product and avatar buckets containing only images', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ name: 'asset.webp', metadata: { mimetype: 'image/webp' } }],
      error: null,
    })

    const result = await auditPublicBuckets(adminWithList(list), [
      { id: 'product-images', public: true },
      { id: 'avatars', public: true },
      { id: 'repair-images', public: false },
    ])

    expect(result.status).toBe('healthy')
    expect(result.severity).toBe('info')
    expect(result.metadata).toMatchObject({ publicBuckets: 2, privateBuckets: 1, inspectedObjects: 2 })
  })

  it('warns for an unknown public bucket even when its sampled content is an image', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ name: 'asset.png', metadata: { mimetype: 'image/png' } }],
      error: null,
    })

    const result = await auditPublicBuckets(adminWithList(list), [
      { id: 'marketing-assets', public: true },
    ])

    expect(result.status).toBe('warning')
    expect(result.findings.join(' ')).toContain('marketing-assets')
  })

  it('stops inspection at the global object cap without exposing object names', async () => {
    const list = vi.fn().mockResolvedValue({
      data: Array.from({ length: 3 }, (_, index) => ({
        name: `secret-${index}.jpg`,
        metadata: { mimetype: 'image/jpeg' },
      })),
      error: null,
    })

    const result = await auditPublicBuckets(
      adminWithList(list),
      [{ id: 'product-images', public: true }],
      { objectLimit: 2, pageSize: 2 },
    )

    expect(result.metadata).toMatchObject({ inspectedObjects: 2, truncated: true })
    expect(JSON.stringify(result)).not.toContain('secret-')
  })

  it('returns unknown when a public bucket cannot be inspected', async () => {
    const list = vi.fn().mockResolvedValue({ data: null, error: new Error('list denied') })

    const result = await auditPublicBuckets(adminWithList(list), [
      { id: 'product-images', public: true },
    ])

    expect(result.status).toBe('unknown')
    expect(result.severity).toBe('medium')
    expect(result.summary).toContain('No se pudo inspeccionar')
  })
})
