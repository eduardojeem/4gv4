import { describe, expect, it, vi } from 'vitest'
import { OfflineManager, formatStorageSize, getStoragePercentage } from '../offline-manager'

vi.mock('idb', () => ({ openDB: vi.fn() }))

describe('offline manager current contract', () => {
  it('formats storage sizes for the POS status UI', () => {
    expect(formatStorageSize(0)).toBe('0 B')
    expect(formatStorageSize(1024)).toBe('1.00 KB')
    expect(formatStorageSize(1024 * 1024)).toBe('1.00 MB')
  })

  it('calculates storage usage and handles an unavailable quota', () => {
    expect(getStoragePercentage(25, 100)).toBe(25)
    expect(getStoragePercentage(50, 0)).toBe(0)
  })

  it('registers and removes connectivity listeners', () => {
    const manager = new OfflineManager()
    const listener = vi.fn()
    const unsubscribe = manager.addConnectivityListener(listener)

    expect(unsubscribe).toBeTypeOf('function')
    expect(() => unsubscribe()).not.toThrow()
    manager.stopSyncInterval()
  })
})
