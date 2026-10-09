import { describe, expect, it } from 'vitest'
import { isPublicStaticAsset, obsoletePrivateCache } from '@/lib/pwa/cache-policy'

describe('PWA cache privacy', () => {
  const origin = 'https://www.mitiendapy.com'
  it('only caches immutable same-origin Next assets', () => {
    expect(isPublicStaticAsset(new URL('/_next/static/chunks/app.js', origin), origin, 'GET')).toBe(true)
    for (const path of ['/api/products', '/dashboard', '/saas', '/_next/image', '/turno/token', '/_next/static/../data/user.json']) {
      expect(isPublicStaticAsset(new URL(path, origin), origin, 'GET')).toBe(false)
    }
    expect(isPublicStaticAsset(new URL('/_next/static/a.js', 'https://elsewhere.test'), origin, 'GET')).toBe(false)
    expect(isPublicStaticAsset(new URL('/_next/static/a.js', origin), origin, 'POST')).toBe(false)
  })
  it('removes the old plugin private caches without deleting unrelated caches', () => {
    for (const name of ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'start-url', 'next-data', 'workbox-precache-v2-old']) expect(obsoletePrivateCache(name)).toBe(true)
    expect(obsoletePrivateCache('another-app')).toBe(false)
    expect(obsoletePrivateCache('mitiendapy-static-v1')).toBe(false)
  })
})
