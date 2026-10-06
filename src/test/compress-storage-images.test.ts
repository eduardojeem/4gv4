import { describe, expect, it } from 'vitest'
import { isCandidate, profileForPath } from '../../scripts/compress-storage-images'

const KB = 1024

describe('compresión de las fotos viejas del almacenamiento', () => {
  it('usa el perfil de subida que corresponde a cada carpeta', () => {
    expect(profileForPath('logos/org/logo.png')).toBe('logo')
    expect(profileForPath('website/logos/org/abc.png')).toBe('logo')
    expect(profileForPath('website/promotions/org/banner.jpg')).toBe('banner')
    expect(profileForPath('website/hero/org/portada.jpg')).toBe('banner')
    expect(profileForPath('products/abc.jpeg')).toBe('product')
  })

  it('solo toca JPG/PNG pesados y nunca la marca, la papelera ni los respaldos', () => {
    expect(isCandidate({ path: 'products/a.jpg', size: 400 * KB })).toBe(true)
    expect(isCandidate({ path: 'products/a.PNG', size: 400 * KB })).toBe(true)
    expect(isCandidate({ path: 'products/a.jpg', size: 100 * KB })).toBe(false)
    expect(isCandidate({ path: 'products/a.webp', size: 900 * KB })).toBe(false)
    expect(isCandidate({ path: 'products/a.gif', size: 900 * KB })).toBe(false)
    expect(isCandidate({ path: 'branding/platform/logo.png', size: 900 * KB })).toBe(false)
    expect(isCandidate({ path: '_papelera/2026-10-01/products/a.jpg', size: 900 * KB })).toBe(false)
    expect(isCandidate({ path: '_respaldo-conversion/2026-10-06/products/a.jpg', size: 900 * KB })).toBe(false)
  })
})
