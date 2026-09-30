import { describe, expect, it } from 'vitest'
import { extractReferencedPaths, selectOrphanCandidates, type StorageFile } from '@/lib/superadmin/storage-cleanup'

const OLD = '2026-01-01T00:00:00Z'
const CUTOFF = Date.parse('2026-09-20T00:00:00Z')

describe('extractReferencedPaths', () => {
  it('encuentra rutas en URLs públicas, rutas relativas y JSON anidado', () => {
    const row = JSON.stringify({
      image_url: 'https://x.supabase.co/storage/v1/object/public/product-images/products/a%20b.png?v=1',
      images: ['products/c.webp'],
      value: { gallery: [{ src: 'https://x.supabase.co/storage/v1/object/public/product-images/products/sub/d.jpg' }] },
    })
    expect(extractReferencedPaths(row)).toEqual(['products/a b.png', 'products/c.webp', 'products/sub/d.jpg'])
  })

  it('no confunde otras carpetas del bucket', () => {
    expect(extractReferencedPaths('product-images/branding/platform/logo.png')).toEqual([])
  })
})

describe('selectOrphanCandidates', () => {
  const file = (path: string, updatedAt: string | null = OLD, size = 10): StorageFile => ({ path, size, updatedAt })

  it('nunca propone archivos fuera de products/ aunque nadie los referencie', () => {
    const { candidates } = selectOrphanCandidates(
      [file('branding/platform/logo.png'), file('logos/org/logo.jpeg'), file('website/logos/x.png'), file('products/huerfano.png')],
      new Set(),
      CUTOFF,
    )
    expect(candidates.map((c) => c.path)).toEqual(['products/huerfano.png'])
  })

  it('respeta las referencias y omite archivos recientes o sin fecha', () => {
    const result = selectOrphanCandidates(
      [file('products/en-uso.png'), file('products/nuevo.png', '2026-09-25T00:00:00Z'), file('products/sin-fecha.png', null), file('products/viejo.png', OLD, 99)],
      new Set(['products/en-uso.png']),
      CUTOFF,
    )
    expect(result.candidates.map((c) => c.path)).toEqual(['products/viejo.png'])
    expect(result.skippedRecent).toBe(2)
  })
})
