import { createClient } from '@/lib/supabase/client'

export interface OrphanedFile {
  name: string
  path: string
  size: number
  lastModified: string
  publicUrl: string
}

export interface StorageSummary {
  totalFiles: number
  totalSize: number
  orphanedCount: number
  orphanedSize: number
}

export interface StorageCleanupScan {
  orphanedFiles: OrphanedFile[]
  summary: StorageSummary
}

interface StorageFileEntry {
  id: string | null
  name: string
  created_at?: string
  updated_at?: string
  metadata?: {
    size?: number
  }
  fullPath: string
}

interface ProductImageRow {
  images?: string[] | null
  image_url?: string | null
}

class StorageCleanupService {
  private supabase = createClient()

  // Lista todos los archivos de un bucket de forma recursiva
  async listAllFiles(bucket: string, folder: string = ''): Promise<StorageFileEntry[]> {
    const { data, error } = await this.supabase.storage.from(bucket).list(folder, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      console.error(`Error listando archivos en ${bucket}/${folder}:`, error)
      return []
    }

    const files: StorageFileEntry[] = []

    for (const item of data || []) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name

      if (item.id === null) {
        const subFiles = await this.listAllFiles(bucket, fullPath)
        files.push(...subFiles)
      } else {
        files.push({
          id: item.id,
          name: item.name,
          created_at: item.created_at,
          updated_at: item.updated_at,
          metadata: item.metadata as StorageFileEntry['metadata'],
          fullPath,
        })
      }
    }

    return files
  }

  // Obtiene todos los URLs de imágenes de productos de la base de datos
  async getInUseImages(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('products')
      .select('images, image_url')

    if (error) {
      console.error('Error obteniendo imágenes en uso:', error)
      return new Set()
    }

    const inUse = new Set<string>()

    ;(data as ProductImageRow[]).forEach((product) => {
      if (Array.isArray(product.images)) {
        product.images.forEach((url) => {
          if (url) inUse.add(this.extractPathFromUrl(url))
        })
      }

      if (product.image_url) {
        inUse.add(this.extractPathFromUrl(product.image_url))
      }
    })

    return inUse
  }

  // Extrae el path relativo del URL de Supabase Storage
  private extractPathFromUrl(url: string): string {
    if (!url) return ''

    if (url.includes('/storage/v1/object/public/')) {
      const parts = url.split('/storage/v1/object/public/')
      if (parts.length > 1) {
        const pathWithBucket = parts[1]
        const pathParts = pathWithBucket.split('/')
        return pathParts.slice(1).join('/')
      }
    }

    return url.split('/').pop() || url
  }

  private buildOrphanedFiles(bucket: string, storageFiles: StorageFileEntry[], inUsePaths: Set<string>): OrphanedFile[] {
    return storageFiles
      .filter((file) => {
        const fileName = file.name
        const fullPath = file.fullPath

        return !Array.from(inUsePaths).some((path) =>
          path === fullPath || path === fileName || (path && fullPath.endsWith(path))
        )
      })
      .map((file) => {
        const { data } = this.supabase.storage.from(bucket).getPublicUrl(file.fullPath)

        return {
          name: file.name,
          path: file.fullPath,
          size: file.metadata?.size || 0,
          lastModified: file.updated_at || file.created_at || new Date().toISOString(),
          publicUrl: data.publicUrl,
        }
      })
      .sort((a, b) => b.size - a.size)
  }

  private buildStorageSummary(storageFiles: StorageFileEntry[], orphanedFiles: OrphanedFile[]): StorageSummary {
    const totalSize = storageFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
    const orphanedSize = orphanedFiles.reduce((sum, file) => sum + file.size, 0)

    return {
      totalFiles: storageFiles.length,
      totalSize,
      orphanedCount: orphanedFiles.length,
      orphanedSize,
    }
  }

  async scanCleanup(bucket: string = 'product-images'): Promise<StorageCleanupScan> {
    try {
      const [storageFiles, inUsePaths] = await Promise.all([
        this.listAllFiles(bucket),
        this.getInUseImages(),
      ])

      const orphanedFiles = this.buildOrphanedFiles(bucket, storageFiles, inUsePaths)

      return {
        orphanedFiles,
        summary: this.buildStorageSummary(storageFiles, orphanedFiles),
      }
    } catch (error) {
      console.error('Error analizando storage:', error)
      return {
        orphanedFiles: [],
        summary: {
          totalFiles: 0,
          totalSize: 0,
          orphanedCount: 0,
          orphanedSize: 0,
        },
      }
    }
  }

  async findOrphanedFiles(bucket: string = 'product-images'): Promise<OrphanedFile[]> {
    return (await this.scanCleanup(bucket)).orphanedFiles
  }

  async getStorageSummary(bucket: string = 'product-images'): Promise<StorageSummary> {
    return (await this.scanCleanup(bucket)).summary
  }

  // Eliminar archivos (llama al API seguro del servidor)
  async deleteFiles(bucket: string, paths: string[]): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/superadmin/storage-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, paths })
      })

      return await response.json()
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al eliminar archivos'
      }
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export const storageCleanupService = new StorageCleanupService()
