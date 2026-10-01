import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  optimize: vi.fn(),
  onDrop: undefined as undefined | ((files: File[], rejected: []) => Promise<void>),
}))

vi.mock('@/lib/images/client-upload-optimizer', () => ({
  optimizeImageFile: mocks.optimize,
}))

vi.mock('react-dropzone', () => ({
  useDropzone: (options: { onDrop: typeof mocks.onDrop }) => {
    mocks.onDrop = options.onDrop
    return {
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false,
    }
  },
}))

import { ImageUploader } from './ImageUploader'

describe('ImageUploader product normalization', () => {
  beforeEach(() => {
    mocks.optimize.mockReset()
    mocks.onDrop = undefined
  })

  it('uploads only the normalized WebP file', async () => {
    const original = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' })
    const normalized = new File(['webp'], 'photo.webp', { type: 'image/webp' })
    const onUploadFiles = vi.fn().mockResolvedValue(['https://storage/photo.webp'])
    mocks.optimize.mockResolvedValue(normalized)

    render(<ImageUploader images={[]} onChange={vi.fn()} onUploadFiles={onUploadFiles} />)
    await act(async () => mocks.onDrop?.([original], []))

    expect(mocks.optimize).toHaveBeenCalledWith(original, 'product', expect.any(Function))
    expect(onUploadFiles).toHaveBeenCalledWith([normalized])
  })

  it('does not upload the original when optimization fails', async () => {
    const original = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' })
    const onUploadFiles = vi.fn()
    mocks.optimize.mockRejectedValue(new Error('compression failed'))

    render(<ImageUploader images={[]} onChange={vi.fn()} onUploadFiles={onUploadFiles} />)
    await act(async () => mocks.onDrop?.([original], []))

    expect(onUploadFiles).not.toHaveBeenCalled()
  })
})
