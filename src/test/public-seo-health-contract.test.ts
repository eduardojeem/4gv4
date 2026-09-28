import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('public SEO and health contracts', () => {
  it('uses one canonical URL source for sitemap and robots', () => {
    expect(read('src/app/sitemap.ts')).toContain('const baseUrl = getSiteUrl()')
    expect(read('src/app/robots.ts')).toContain('const baseUrl = getSiteUrl()')
    expect(read('src/lib/health/checks/web.ts')).not.toContain('sitemap.ts y robots.ts usan NEXT_PUBLIC_BASE_URL')
  })

  it('declares a default Open Graph image in root metadata', () => {
    const layout = read('src/app/layout.tsx')

    expect(layout).toContain("import { OG_IMAGE_PATH } from '@/lib/seo/page-metadata'")
    expect(layout).toContain('images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630 }]')
  })

  it('distinguishes implemented legal routes awaiting publication from missing pages', () => {
    const checks = read('src/lib/health/checks/web.ts')

    expect(checks).toContain('Implementada, sin versión publicada')
  })
})
