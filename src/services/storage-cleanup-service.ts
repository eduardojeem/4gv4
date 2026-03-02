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

class StorageCleanupService {
  private supabase = createClient()

  // Lista todos los archivos de un bucket de forma recursiva
  async listAllFiles(bucket: string, folder: string = ''): Promise<any[]> {
    const { data, error } = await this.supabase.storage.from(bucket).list(folder, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      console.error(`Error listando archivos en ${bucket}/${folder}:`, error)
      return []
    }

    let files: any[] = []

    for (const item of data || []) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name
      
      if (item.id === null) {
        // Es un folder o placeholder
        const subFiles = await this.listAllFiles(bucket, fullPath)
        files = [...files, ...subFiles]
      } else {
        files.push({ ...item, fullPath })
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

    data.forEach(product => {
      // De images[]
      if (Array.isArray(product.images)) {
        product.images.forEach((url: string) => {
          if (url) inUse.add(this.extractPathFromUrl(url))
        })
      }
      // De image_url (legacy)
      if (product.image_url) {
        inUse.add(this.extractPathFromUrl(product.image_url))
      }
    })

    return inUse
  }

  // Extrae el path relativo del URL de Supabase Storage
  private extractPathFromUrl(url: string): string {
    if (!url) return ''
    
    // Si es un URL de Supabase: .../storage/v1/object/public/bucket-name/folder/file.jpg
    if (url.includes('/storage/v1/object/public/')) {
      const parts = url.split('/storage/v1/object/public/')
      if (parts.length > 1) {
        // bucket-name/folder/file.jpg
        const pathWithBucket = parts[1]
        const pathParts = pathWithBucket.split('/')
        // Quitamos el bucket name (primer elemento)
        return pathParts.slice(1).join('/')
      }
    }
    
    // Si ya es un path relativo o un URL desconocido, devolvemos el final
    return url.split('/').pop() || url
  }

  // Encuentra archivos que no están asociados a ningún producto
  async findOrphanedFiles(bucket: string = 'product-images'): Promise<OrphanedFile[]> {
    try {
      const [storageFiles, inUsePaths] = await Promise.all([
        this.listAllFiles(bucket),
        this.getInUseImages()
      ])

      const orphaned: OrphanedFile[] = []

      storageFiles.forEach(file => {
        // Comparamos el path completo o solo el nombre si el path es complejo
        const fileName = file.name
        const fullPath = file.fullPath

        const isInUse = Array.from(inUsePaths).some(path => 
          path === fullPath || path === fileName || (path && fullPath.endsWith(path))
        )

        if (!isInUse) {
          const { data } = this.supabase.storage.from(bucket).getPublicUrl(fullPath)
          orphaned.push({
            name: file.name,
            path: fullPath,
            size: file.metadata?.size || 0,
            lastModified: file.updated_at || file.created_at || new Date().toISOString(),
            publicUrl: data.publicUrl
          })
        }
      })

      return orphaned.sort((a, b) => b.size - a.size)
    } catch (error) {
      console.error('Error buscando archivos huérfanos:', error)
      return []
    }
  }

  // Obtener resumen de ahorro potencial
  async getStorageSummary(bucket: string = 'product-images'): Promise<StorageSummary> {
    const allFiles = await this.listAllFiles(bucket)
    const orphaned = await this.findOrphanedFiles(bucket)

    const totalSize = allFiles.reduce((sum, f) => sum + (f.metadata?.size || 0), 0)
    const orphanedSize = orphaned.reduce((sum, f) => sum + f.size, 0)

    return {
      totalFiles: allFiles.length,
      totalSize,
      orphanedCount: orphaned.length,
      orphanedSize
    }
  }

  // Eliminar archivos (llama al API seguro del servidor)
  async deleteFiles(bucket: string, paths: string[]): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/admin/storage-cleanup', {
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
