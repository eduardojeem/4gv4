import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStorageCleanup } from '@/hooks/use-storage-cleanup'

const storageMocks = vi.hoisted(() => ({
  scanCleanup: vi.fn(),
  deleteFiles: vi.fn(),
}))

vi.mock('@/services/storage-cleanup-service', () => ({
  storageCleanupService: {
    scanCleanup: storageMocks.scanCleanup,
    deleteFiles: storageMocks.deleteFiles,
  },
}))

describe('useStorageCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storageMocks.scanCleanup.mockResolvedValue({
      orphanedFiles: [
        {
          name: 'foo.png',
          path: 'foo.png',
          size: 2048,
          lastModified: '2026-01-01T00:00:00.000Z',
          publicUrl: 'https://example.com/foo.png',
        },
      ],
      summary: {
        totalFiles: 5,
        totalSize: 4096,
        orphanedCount: 1,
        orphanedSize: 2048,
      },
    })
  })

  it('uses the combined scan service only once per scan', async () => {
    const { result } = renderHook(() => useStorageCleanup())

    await act(async () => {
      await result.current.scan()
    })

    expect(storageMocks.scanCleanup).toHaveBeenCalledTimes(1)
    expect(result.current.summary?.orphanedCount).toBe(1)
    expect(result.current.orphanedFiles).toHaveLength(1)
  })
})
