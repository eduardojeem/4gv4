import { useState, useCallback } from 'react'
import { storageCleanupService, OrphanedFile, StorageSummary } from '@/services/storage-cleanup-service'
import { toast } from 'sonner'

export function useStorageCleanup(bucket: string = 'product-images') {
  const [orphanedFiles, setOrphanedFiles] = useState<OrphanedFile[]>([])
  const [summary, setSummary] = useState<StorageSummary | null>(null)
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  const scan = useCallback(async () => {
    setScanning(true)
    try {
      const result = await storageCleanupService.scanCleanup(bucket)
      setOrphanedFiles(result.orphanedFiles)
      setSummary(result.summary)
      setSelectedPaths(new Set())
    } catch {
      toast.error('Error al escanear storage')
    } finally {
      setScanning(false)
    }
  }, [bucket])

  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const selectAll = () => {
    if (selectedPaths.size === orphanedFiles.length) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(orphanedFiles.map(file => file.path)))
    }
  }

  const deleteSelected = async () => {
    if (selectedPaths.size === 0) return

    setDeleting(true)
    try {
      const paths = Array.from(selectedPaths)
      const result = await storageCleanupService.deleteFiles(bucket, paths)

      if (result.success) {
        toast.success(result.message)
        await scan()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Error al eliminar archivos')
    } finally {
      setDeleting(false)
    }
  }

  const deleteAll = async () => {
    if (orphanedFiles.length === 0) return

    setDeleting(true)
    try {
      const paths = orphanedFiles.map(file => file.path)
      const result = await storageCleanupService.deleteFiles(bucket, paths)

      if (result.success) {
        toast.success(result.message)
        await scan()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Error al eliminar archivos')
    } finally {
      setDeleting(false)
    }
  }

  return {
    orphanedFiles,
    summary,
    scanning,
    deleting,
    selectedPaths,
    scan,
    toggleSelect,
    selectAll,
    deleteSelected,
    deleteAll
  }
}
