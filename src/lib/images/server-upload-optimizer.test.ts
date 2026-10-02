import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { optimizeServerImage } from './server-upload-optimizer'

describe('optimizeServerImage', () => {
  it('decodes, resizes and emits a product WebP', async () => {
    const input = await sharp({
      create: { width: 1800, height: 900, channels: 3, background: '#dd4422' },
    }).jpeg().toBuffer()

    const result = await optimizeServerImage(input, 'image/jpeg', 'camera.jpg', 'product')
    const metadata = await sharp(result.buffer).metadata()

    expect(result.mimeType).toBe('image/webp')
    expect(result.extension).toBe('webp')
    expect(result.fileName).toBe('camera.webp')
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBeLessThanOrEqual(1280)
    expect(metadata.height).toBeLessThanOrEqual(1280)
  })

  it('preserves alpha when normalizing a transparent logo', async () => {
    const input = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer()

    const result = await optimizeServerImage(input, 'image/png', 'logo.png', 'logo')
    const metadata = await sharp(result.buffer).metadata()

    expect(metadata.hasAlpha).toBe(true)
  })

  it('preserves admitted SVG input', async () => {
    const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')
    const result = await optimizeServerImage(input, 'image/svg+xml', 'logo.svg', 'logo')

    expect(result.buffer).toEqual(input)
    expect(result.mimeType).toBe('image/svg+xml')
    expect(result.extension).toBe('svg')
  })

  it('preserves admitted GIF input instead of flattening it', async () => {
    const input = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#2255aa' },
    }).gif().toBuffer()
    const result = await optimizeServerImage(input, 'image/gif', 'motion.gif', 'logo')

    expect(result.buffer).toEqual(input)
    expect(result.mimeType).toBe('image/gif')
    expect(result.extension).toBe('gif')
  })

  it('rejects a corrupt raster even when its MIME looks valid', async () => {
    await expect(optimizeServerImage(
      Buffer.from('not a png'),
      'image/png',
      'broken.png',
      'product',
    )).rejects.toThrow(/decodificar|decode|imagen/i)
  })
})
