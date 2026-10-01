import { beforeEach, describe, expect, it, vi } from 'vitest'

const compressMock = vi.hoisted(() => vi.fn())

vi.mock('browser-image-compression', () => ({ __esModule: true, default: compressMock }))

import { optimizeImageFile } from './client-upload-optimizer'

describe('optimizeImageFile', () => {
  beforeEach(() => {
    compressMock.mockReset()
  })

  it('normalizes a product raster to the product WebP budget', async () => {
    const progress = vi.fn()
    const source = new File(['jpeg'], 'camera.JPG', { type: 'image/jpeg' })
    const compressed = new Blob(['webp'], { type: 'image/webp' })
    compressMock.mockImplementation(async (_file, options) => {
      options.onProgress(37)
      return compressed
    })

    const result = await optimizeImageFile(source, 'product', progress)

    expect(compressMock).toHaveBeenCalledWith(source, expect.objectContaining({
      maxSizeMB: 0.2,
      maxWidthOrHeight: 1280,
      fileType: 'image/webp',
      useWebWorker: true,
    }))
    expect(progress).toHaveBeenCalledWith(37)
    expect(result).toBeInstanceOf(File)
    expect(result.name).toBe('camera.webp')
    expect(result.type).toBe('image/webp')
  })

  it('rejects instead of returning the original when compression fails', async () => {
    const source = new File(['large'], 'large.png', { type: 'image/png' })
    compressMock.mockRejectedValue(new Error('decoder failed'))

    await expect(optimizeImageFile(source, 'product')).rejects.toThrow('decoder failed')
  })
})
