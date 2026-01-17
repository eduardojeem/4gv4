import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OfflineManager } from '../offline-manager'

// Mock IndexedDB
const mockIDB = {
  openDB: vi.fn(),
  deleteDB: vi.fn()
}

vi.mock('idb', () => mockIDB)

describe('OfflineManager', () => {
  let manager: OfflineManager

  beforeEach(() => {
    manager = new OfflineManager()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize IndexedDB', async () => {
      const mockDB = {
        createObjectStore: vi.fn(),
        transaction: vi.fn()
      }

      mockIDB.openDB.mockResolvedValue(mockDB)

      await manager.initialize()

      expect(mockIDB.openDB).toHaveBeenCalledWith(
        'pos-offline',
        expect.any(Number),
        expect.any(Object)
      )
    })

    it('should handle initialization errors', async () => {
      mockIDB.openDB.mockRejectedValue(new Error('DB Error'))

      await expect(manager.initialize()).rejects.toThrow('DB Error')
    })
  })

  describe('connectivity detection', () => {
    it('should detect online status', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true
      })

      expect(manager.isOnline()).toBe(true)
    })

    it('should detect offline status', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      })

      expect(manager.isOnline()).toBe(false)
    })
  })

  describe('cache operations', () => {
    it('should cache products', async () => {
      const products = [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 }
      ]

      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            put: vi.fn()
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      await manager.cacheProducts(products)

      expect(mockDB.transaction).toHaveBeenCalledWith('products', 'readwrite')
    })

    it('should retrieve cached products', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', price: 100 }
      ]

      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            getAll: vi.fn().mockResolvedValue(mockProducts)
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      const products = await manager.getCachedProducts()

      expect(products).toEqual(mockProducts)
    })
  })

  describe('sync queue', () => {
    it('should add sale to queue when offline', async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      })

      const sale = {
        id: 'sale_1',
        total: 1000,
        items: []
      }

      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            add: vi.fn()
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      await manager.queueSale(sale)

      expect(mockDB.transaction).toHaveBeenCalledWith('sync_queue', 'readwrite')
    })

    it('should get pending sales count', async () => {
      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(5)
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      const count = await manager.getPendingSalesCount()

      expect(count).toBe(5)
    })

    it('should sync pending sales when online', async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true
      })

      const mockSales = [
        { id: 'sale_1', total: 1000 },
        { id: 'sale_2', total: 2000 }
      ]

      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            getAll: vi.fn().mockResolvedValue(mockSales),
            delete: vi.fn()
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      const syncFn = vi.fn().mockResolvedValue(true)
      const results = await manager.syncPendingSales(syncFn)

      expect(syncFn).toHaveBeenCalledTimes(2)
      expect(results.synced).toBe(2)
      expect(results.failed).toBe(0)
    })
  })

  describe('storage stats', () => {
    it('should return storage statistics', async () => {
      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(10)
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      const stats = await manager.getStats()

      expect(stats).toHaveProperty('cachedProducts')
      expect(stats).toHaveProperty('pendingSales')
      expect(stats).toHaveProperty('lastSync')
    })
  })

  describe('cleanup', () => {
    it('should clear old cache entries', async () => {
      const mockDB = {
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            openCursor: vi.fn(),
            delete: vi.fn()
          })
        })
      }

      mockIDB.openDB.mockResolvedValue(mockDB)
      await manager.initialize()

      await manager.clearOldCache(7) // 7 days

      expect(mockDB.transaction).toHaveBeenCalled()
    })
  })
})
