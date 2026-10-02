import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('website image upload route contracts', () => {
  it.each([
    ['media', "section === 'logo' || section === 'brands' ? 'logo' : 'banner'"],
    ['logo', "'logo'"],
    ['brand-logo', "'logo'"],
    ['promotion-image', "'banner'"],
  ])('normalizes %s uploads with the intended profile', (route, profile) => {
    const source = read(`src/app/api/admin/website/${route}/route.ts`)
    expect(source).toContain('optimizeServerImage')
    expect(source).toContain(profile)
    expect(source).toContain('cacheControl: PUBLIC_IMAGE_CACHE_CONTROL')
    expect(source).toContain('contentType: optimized.mimeType')
    expect(source).toMatch(/\$\{optimized\.extension\}/)
    expect(source).not.toContain('?v=${Date.now()}')
  })

  it('keeps authorization and organization resolution before image processing', () => {
    for (const route of ['media', 'logo', 'brand-logo', 'promotion-image']) {
      const source = read(`src/app/api/admin/website/${route}/route.ts`)
      expect(source.indexOf('resolveWebsiteAdminOrganizationId')).toBeLessThan(
        source.lastIndexOf('optimizeServerImage'),
      )
      expect(source).toContain('withAdminAuth')
    }
  })

  it('records the optimized byte size in website media history', () => {
    for (const route of ['media', 'logo', 'brand-logo', 'promotion-image']) {
      const source = read(`src/app/api/admin/website/${route}/route.ts`)
      expect(source).toContain('size: optimized.buffer.byteLength')
    }
  })
})
