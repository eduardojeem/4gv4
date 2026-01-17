/**
 * Offline Manager - Gestión de modo offline con IndexedDB
 * 
 * Características:
 * - Cache completo de productos en IndexedDB
 * - Detección automática de conectividad
 * - Sincronización transparente
 * - Manejo de conflictos
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface POSDatabase extends DBSchema {
  products: {
    key: string
    value: CachedProduct
    indexes: { 'by-updated': Date }
  }
  sales: {
    key: string
    value: PendingSale
    indexes: { 'by-status': SyncStatus }
  }
  metadata: {
    key: string
    value: MetadataEntry
  }
}

export interface CachedProduct {
  id: string
  name: string
  sku: string
  barcode?: string
  price: number
  cost: number
  stock: number
  category: string
  image_url?: string
  description?: string
  is_active: boolean
  cached_at: Date
  updated_at: Date
}

export interface PendingSale {
  id: string
  items: SaleItem[]
  total: number
  subtotal: number
  tax: number
  payment_method: string
  customer_id?: string
  created_at: Date
  status: SyncStatus
  retry_count: number
  error?: string
}

export interface SaleItem {
  product_id: string
  quantity: number
  price: number
  discount: number
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error'

export interface MetadataEntry {
  key: string
  value: any
  updated_at: Date
}

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: Array<{ id: string; error: string }>
}

export interface OfflineStats {
  isOnline: boolean
  lastSync: Date | null
  pendingSales: number
  cachedProducts: number
  storageUsed: number
  storageQuota: number
}

// ============================================================================
// Offline Manager Class
// ============================================================================

class OfflineManager {
  private db: IDBPDatabase<POSDatabase> | null = null
  private isOnline: boolean = true
  private syncInterval: NodeJS.Timeout | null = null
  private listeners: Set<(isOnline: boolean) => void> = new Set()

  // Database name and version
  private readonly DB_NAME = 'pos-offline-db'
  private readonly DB_VERSION = 1

  // Sync configuration
  private readonly SYNC_INTERVAL = 30000 // 30 seconds
  private readonly MAX_RETRY_COUNT = 3
  private readonly MAX_CACHE_AGE_DAYS = 7

  /**
   * Initialize the offline manager
   */
  async initialize(): Promise<void> {
    try {
      // Open IndexedDB
      this.db = await openDB<POSDatabase>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Products store
          if (!db.objectStoreNames.contains('products')) {
            const productStore = db.createObjectStore('products', {
              keyPath: 'id',
            })
            productStore.createIndex('by-updated', 'updated_at')
          }

          // Sales store
          if (!db.objectStoreNames.contains('sales')) {
            const salesStore = db.createObjectStore('sales', {
              keyPath: 'id',
            })
            salesStore.createIndex('by-status', 'status')
          }

          // Metadata store
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' })
          }
        },
      })

      // Setup online/offline detection
      this.setupConnectivityDetection()

      // Start sync interval
      this.startSyncInterval()

      // Clean old cache
      await this.cleanOldCache()

      console.log('✅ Offline Manager initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Offline Manager:', error)
      throw error
    }
  }

  /**
   * Setup connectivity detection
   */
  private setupConnectivityDetection(): void {
    this.isOnline = navigator.onLine

    window.addEventListener('online', () => {
      console.log('🌐 Connection restored')
      this.isOnline = true
      this.notifyListeners(true)
      this.syncPendingSales()
    })

    window.addEventListener('offline', () => {
      console.log('📴 Connection lost')
      this.isOnline = false
      this.notifyListeners(false)
    })
  }

  /**
   * Start automatic sync interval
   */
  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncPendingSales()
      }
    }, this.SYNC_INTERVAL)
  }

  /**
   * Stop sync interval
   */
  stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Add connectivity listener
   */
  addConnectivityListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach((listener) => listener(isOnline))
  }

  // ==========================================================================
  // Products Cache
  // ==========================================================================

  /**
   * Cache products in IndexedDB
   */
  async cacheProducts(products: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const tx = this.db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')

    const now = new Date()

    for (const product of products) {
      const cached: CachedProduct = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        category: product.category,
        image_url: product.image_url,
        description: product.description,
        is_active: product.is_active,
        cached_at: now,
        updated_at: new Date(product.updated_at || now),
      }

      await store.put(cached)
    }

    await tx.done

    // Update metadata
    await this.setMetadata('last_cache_update', now)

    console.log(`✅ Cached ${products.length} products`)
  }

  /**
   * Get cached products
   */
  async getCachedProducts(): Promise<CachedProduct[]> {
    if (!this.db) throw new Error('Database not initialized')

    const products = await this.db.getAll('products')
    return products.filter((p) => p.is_active)
  }

  /**
   * Get single cached product
   */
  async getCachedProduct(id: string): Promise<CachedProduct | undefined> {
    if (!this.db) throw new Error('Database not initialized')
    return await this.db.get('products', id)
  }

  /**
   * Search cached products
   */
  async searchCachedProducts(query: string): Promise<CachedProduct[]> {
    const products = await this.getCachedProducts()
    const lowerQuery = query.toLowerCase()

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        p.barcode?.toLowerCase().includes(lowerQuery)
    )
  }

  // ==========================================================================
  // Sales Queue
  // ==========================================================================

  /**
   * Add sale to pending queue
   */
  async addPendingSale(sale: Omit<PendingSale, 'id' | 'status' | 'retry_count'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const id = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const pendingSale: PendingSale = {
      ...sale,
      id,
      status: 'pending',
      retry_count: 0,
    }

    await this.db.put('sales', pendingSale)

    console.log(`📝 Sale queued for sync: ${id}`)

    // Try to sync immediately if online
    if (this.isOnline) {
      setTimeout(() => this.syncPendingSales(), 100)
    }

    return id
  }

  /**
   * Get pending sales
   */
  async getPendingSales(): Promise<PendingSale[]> {
    if (!this.db) throw new Error('Database not initialized')

    const index = this.db.transaction('sales').store.index('by-status')
    return await index.getAll('pending')
  }

  /**
   * Sync pending sales to server
   */
  async syncPendingSales(): Promise<SyncResult> {
    if (!this.db) throw new Error('Database not initialized')
    if (!this.isOnline) {
      return { success: false, synced: 0, failed: 0, errors: [] }
    }

    const pending = await this.getPendingSales()

    if (pending.length === 0) {
      return { success: true, synced: 0, failed: 0, errors: [] }
    }

    console.log(`🔄 Syncing ${pending.length} pending sales...`)

    let synced = 0
    let failed = 0
    const errors: Array<{ id: string; error: string }> = []

    for (const sale of pending) {
      try {
        // Update status to syncing
        await this.updateSaleStatus(sale.id, 'syncing')

        // TODO: Replace with actual API call
        await this.syncSaleToServer(sale)

        // Mark as synced
        await this.updateSaleStatus(sale.id, 'synced')
        synced++

        console.log(`✅ Sale synced: ${sale.id}`)
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ id: sale.id, error: errorMessage })

        // Update retry count
        const retryCount = sale.retry_count + 1

        if (retryCount >= this.MAX_RETRY_COUNT) {
          await this.updateSaleStatus(sale.id, 'error', errorMessage)
          console.error(`❌ Sale failed after ${retryCount} retries: ${sale.id}`)
        } else {
          await this.updateSaleStatus(sale.id, 'pending')
          await this.db.put('sales', { ...sale, retry_count: retryCount })
          console.warn(`⚠️ Sale retry ${retryCount}/${this.MAX_RETRY_COUNT}: ${sale.id}`)
        }
      }
    }

    // Update last sync time
    await this.setMetadata('last_sync', new Date())

    const result = {
      success: failed === 0,
      synced,
      failed,
      errors,
    }

    console.log(`🔄 Sync complete: ${synced} synced, ${failed} failed`)

    return result
  }

  /**
   * Sync single sale to server (placeholder)
   */
  private async syncSaleToServer(sale: PendingSale): Promise<void> {
    // TODO: Implement actual API call to Supabase
    // This is a placeholder that simulates the API call

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Simulate 10% failure rate for testing
    if (Math.random() < 0.1) {
      throw new Error('Network error')
    }

    // In production, this would be:
    // const { error } = await supabase.from('sales').insert({
    //   items: sale.items,
    //   total: sale.total,
    //   subtotal: sale.subtotal,
    //   tax: sale.tax,
    //   payment_method: sale.payment_method,
    //   customer_id: sale.customer_id,
    //   created_at: sale.created_at,
    // })
    // if (error) throw error
  }

  /**
   * Update sale status
   */
  private async updateSaleStatus(
    id: string,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const sale = await this.db.get('sales', id)
    if (!sale) return

    await this.db.put('sales', {
      ...sale,
      status,
      error,
    })
  }

  // ==========================================================================
  // Metadata
  // ==========================================================================

  /**
   * Set metadata
   */
  async setMetadata(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.put('metadata', {
      key,
      value,
      updated_at: new Date(),
    })
  }

  /**
   * Get metadata
   */
  async getMetadata(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized')

    const entry = await this.db.get('metadata', key)
    return entry?.value
  }

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  /**
   * Clean old cache
   */
  async cleanOldCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const maxAge = this.MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - maxAge)

    const tx = this.db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')
    const index = store.index('by-updated')

    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff))
    let deleted = 0

    while (cursor) {
      await cursor.delete()
      deleted++
      cursor = await cursor.continue()
    }

    await tx.done

    if (deleted > 0) {
      console.log(`🧹 Cleaned ${deleted} old cached products`)
    }
  }

  /**
   * Get offline statistics
   */
  async getStats(): Promise<OfflineStats> {
    if (!this.db) throw new Error('Database not initialized')

    const [cachedProducts, pendingSales, lastSync] = await Promise.all([
      this.db.count('products'),
      this.getPendingSales().then((sales) => sales.length),
      this.getMetadata('last_sync'),
    ])

    // Get storage usage
    let storageUsed = 0
    let storageQuota = 0

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      storageUsed = estimate.usage || 0
      storageQuota = estimate.quota || 0
    }

    return {
      isOnline: this.isOnline,
      lastSync: lastSync ? new Date(lastSync) : null,
      pendingSales,
      cachedProducts,
      storageUsed,
      storageQuota,
    }
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await Promise.all([
      this.db.clear('products'),
      this.db.clear('sales'),
      this.db.clear('metadata'),
    ])

    console.log('🧹 All offline data cleared')
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    this.stopSyncInterval()

    if (this.db) {
      this.db.close()
      this.db = null
    }

    this.listeners.clear()

    console.log('👋 Offline Manager closed')
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const offlineManager = new OfflineManager()

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format storage size
 */
export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Calculate storage percentage
 */
export function getStoragePercentage(used: number, quota: number): number {
  if (quota === 0) return 0
  return Math.round((used / quota) * 100)
}
