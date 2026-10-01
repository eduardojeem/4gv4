import { describe, expect, it } from 'vitest'
import {
  extractReferencedPaths,
  imageFamily,
  orphanBrake,
  parseTrashPath,
  purgeableAt,
  selectOrphanCandidates,
  trashPathFor,
  type StorageFile,
} from '@/lib/superadmin/storage-cleanup'

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

describe('protección de originales', () => {
  const file = (path: string): StorageFile => ({ path, size: 10, updatedAt: OLD })

  it('no propone el original de una foto que se usa en su versión optimizada', () => {
    // Caso real del 2026-10-01: el producto usa la .webp optimizada y la .jpeg es la foto que subió el negocio.
    const result = selectOrphanCandidates(
      [file('products/4pauhd3y987_1790162956734.jpeg'), file('products/4pauhd3y987_1790162956734-optimized-2026.webp'), file('products/otro_1.jpeg')],
      new Set(['products/4pauhd3y987_1790162956734-optimized-2026.webp']),
      CUTOFF,
    )
    expect(result.candidates.map((c) => c.path)).toEqual(['products/otro_1.jpeg'])
    expect(result.protectedVariants).toBe(1)
  })

  it('agrupa versiones de la misma foto', () => {
    expect(imageFamily('products/abc-optimized-2026-10.webp')).toBe('products/abc')
    expect(imageFamily('products/abc_thumb.jpg')).toBe('products/abc')
    expect(imageFamily('products/abc.jpeg')).toBe('products/abc')
    expect(imageFamily('products/remera-azul.png')).toBe('products/remera-azul')
  })

  it('encuentra rutas con las barras codificadas', () => {
    expect(extractReferencedPaths('/_next/image?url=https%3A%2F%2Fx%2Fproduct-images%2Fproducts%2Fa.webp&w=640')).toContain('products/a.webp')
  })
})

describe('freno de seguridad', () => {
  it('se activa si demasiadas fotos figuran sin uso', () => {
    expect(orphanBrake(52, 469).tripped).toBe(false)
    expect(orphanBrake(300, 469).tripped).toBe(true)
    // Con pocas fotos el porcentaje no dice nada.
    expect(orphanBrake(5, 10).tripped).toBe(false)
  })
})

describe('papelera', () => {
  it('guarda la ruta original y la fecha', () => {
    const trashed = trashPathFor('products/a.jpg', new Date('2026-10-01T15:00:00Z'))
    expect(trashed).toBe('_papelera/2026-10-01/products/a.jpg')
    expect(parseTrashPath(trashed)).toEqual({ originalPath: 'products/a.jpg', trashedOn: '2026-10-01' })
    expect(parseTrashPath('website/logo.png')).toBeNull()
  })

  it('no se puede vaciar antes de 30 días', () => {
    expect(purgeableAt('2026-10-01').toISOString().slice(0, 10)).toBe('2026-10-31')
  })

  it('la papelera nunca es candidata', () => {
    const { candidates } = selectOrphanCandidates(
      [{ path: '_papelera/2026-10-01/products/a.jpg', size: 1, updatedAt: OLD }],
      new Set(),
      CUTOFF,
    )
    expect(candidates).toEqual([])
  })
})
