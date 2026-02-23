import { useState } from 'react'
import { toast } from 'sonner'

interface UploadProgress {
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
}

interface UseImageUploadOptions {
  maxRetries?: number
  retryDelay?: number
  onProgress?: (progress: UploadProgress[]) => void
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const { maxRetries = 3, retryDelay = 1000, onProgress } = options
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])

  const uploadFileWithRetry = async (
    file: File,
    bucket: string,
    path: string,
    attempt = 1
  ): Promise<string> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', bucket)
      formData.append('path', path)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success && result.url) {
        return result.url
      } else {
        throw new Error(result.error || 'Unknown upload error')
      }
    } catch (error) {
      if (attempt < maxRetries) {
        // Esperar antes de reintentar (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        return uploadFileWithRetry(file, bucket, path, attempt + 1)
      }
      throw error
    }
  }

  const uploadFiles = async (
    files: File[],
    bucket: string = 'repair-images'
  ): Promise<string[]> => {
    setIsUploading(true)
    const urls: string[] = []

    // Inicializar progreso
    const initialProgress: UploadProgress[] = files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'pending'
    }))
    setUploadProgress(initialProgress)
    onProgress?.(initialProgress)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // Actualizar estado a "uploading"
        const updatedProgress = [...uploadProgress]
        updatedProgress[i] = { ...updatedProgress[i], status: 'uploading', progress: 50 }
        setUploadProgress(updatedProgress)
        onProgress?.(updatedProgress)

        const ext = file.name.split('.').pop() || 'jpg'
        const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const path = `uploads/${filename}`

        const url = await uploadFileWithRetry(file, bucket, path)
        urls.push(url)

        // Actualizar estado a "success"
        updatedProgress[i] = { ...updatedProgress[i], status: 'success', progress: 100 }
        setUploadProgress(updatedProgress)
        onProgress?.(updatedProgress)
      } catch (error) {
        console.error('Failed to upload image:', file.name, error)
        
        // Actualizar estado a "error"
        const updatedProgress = [...uploadProgress]
        updatedProgress[i] = { ...updatedProgress[i], status: 'error', progress: 0 }
        setUploadProgress(updatedProgress)
        onProgress?.(updatedProgress)

        toast.error(`Error al subir ${file.name}. Intente nuevamente.`)
      }
    }

    setIsUploading(false)
    return urls
  }

  const resetProgress = () => {
    setUploadProgress([])
    setIsUploading(false)
  }

  return {
    uploadFiles,
    isUploading,
    uploadProgress,
    resetProgress
  }
}
