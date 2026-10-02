import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const platform = readFileSync('src/app/api/superadmin/platform-branding/logo/route.ts', 'utf8')
const brands = readFileSync('src/app/api/superadmin/global-brands/logo/route.ts', 'utf8')

describe('superadmin image upload route contracts', () => {
  it.each([platform, brands])('keeps superadmin authorization before processing', (source) => {
    expect(source.indexOf('getSuperAdminUser()')).toBeLessThan(source.lastIndexOf('optimizeServerImage'))
  })

  it.each([platform, brands])('normalizes admitted logos with immutable metadata', (source) => {
    expect(source).toContain("optimizeServerImage")
    expect(source).toContain("'logo'")
    expect(source).toContain('contentType: optimized.mimeType')
    expect(source).toContain('cacheControl: PUBLIC_IMAGE_CACHE_CONTROL')
    expect(source).toContain('upsert: false')
    expect(source).toMatch(/\$\{optimized\.extension\}/)
  })

  it('continues writing an audit event after platform upload', () => {
    expect(platform.indexOf('.upload(')).toBeLessThan(platform.indexOf('logSuperAdminAction({'))
    expect(platform).toContain("action: 'upload_platform_asset'")
  })

  it('preserves SVG support in the global-brand route', () => {
    expect(brands).toContain("'image/svg+xml': 'svg'")
    expect(brands).toContain('optimized.mimeType')
  })
})
